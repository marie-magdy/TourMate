import { jest } from '@jest/globals';

const mockQuery = jest.fn();
jest.unstable_mockModule('../src/db.js', () => ({
  default: { query: mockQuery },
}));

const mockNodeFetch = jest.fn();
jest.unstable_mockModule('node-fetch', () => ({
  default: mockNodeFetch,
}));

beforeAll(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterAll(() => {
  jest.restoreAllMocks();
});

const { default: request } = await import('supertest');
const { default: express } = await import('express');
const { default: router } = await import('../src/routes/recognition.js');

const app = express();
app.use(express.json());
app.use('/api/recognition', router);

beforeEach(() => {
  jest.clearAllMocks();
  process.env.API_KEY = 'test-cv-key';
});


// ── POST /analyze ───────────────────────────────────────────────────
describe('POST /api/recognition/analyze', () => {
  it('returns 400 when no image is attached', async () => {
    const res = await request(app).post('/api/recognition/analyze').field('model_type', 'outdoor');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/No image/);
  });

  it('returns not-recognized response when CV service is unsure', async () => {
    mockNodeFetch.mockResolvedValueOnce({
      json: async () => ({
        recognized: false,
        message: 'Landmark not recognized clearly',
        confidence: 0.42,
      }),
    });

    const res = await request(app)
      .post('/api/recognition/analyze')
      .attach('image', Buffer.from('fake-jpeg-bytes'), 'photo.jpg');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(false);
    expect(res.body.recognized).toBe(false);
    expect(res.body.confidence).toBe(0.42);
  });

  it('returns 200 + attraction=null when CV recognizes a label not in the DB', async () => {
    mockNodeFetch.mockResolvedValueOnce({
      json: async () => ({
        recognized: true,
        model_label: 'unknown_temple',
        confidence: 0.92,
      }),
    });
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/recognition/analyze')
      .attach('image', Buffer.from('fake'), 'photo.jpg');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.recognized).toBe(true);
    expect(res.body.attraction).toBeNull();
    expect(res.body.message).toMatch(/not in database/);
  });

  it('returns the full attraction when a recognized label matches a DB row', async () => {
    mockNodeFetch.mockResolvedValueOnce({
      json: async () => ({
        recognized: true,
        model_label: 'pyramids_giza',
        confidence: 0.95,
      }),
    });
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 1, name: 'Pyramids of Giza', city_name: 'Giza', model_label: 'pyramids_giza' }],
    });

    const res = await request(app)
      .post('/api/recognition/analyze')
      .field('model_type', 'outdoor')
      .attach('image', Buffer.from('fake'), 'photo.jpg');

    expect(res.status).toBe(200);
    expect(res.body.recognized).toBe(true);
    expect(res.body.attraction.name).toBe('Pyramids of Giza');
    expect(res.body.model_type).toBe('outdoor');
  });

  it('forwards x-api-key + model_type to the CV service', async () => {
    mockNodeFetch.mockResolvedValueOnce({
      json: async () => ({ recognized: false, message: 'x', confidence: 0.1 }),
    });

    await request(app)
      .post('/api/recognition/analyze')
      .field('model_type', 'artifact')
      .attach('image', Buffer.from('fake'), 'photo.jpg');

    const [url, opts] = mockNodeFetch.mock.calls[0];
    expect(String(url)).toContain('/recognize');
    expect(opts.method).toBe('POST');
    expect(opts.headers['x-api-key']).toBe('test-cv-key');
  });

  it('returns 503 when the CV service refuses the connection', async () => {
    const err = new Error('connection refused');
    err.code = 'ECONNREFUSED';
    mockNodeFetch.mockRejectedValueOnce(err);

    const res = await request(app)
      .post('/api/recognition/analyze')
      .attach('image', Buffer.from('fake'), 'photo.jpg');

    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/CV service/);
  });

  it('returns 500 on an unexpected error', async () => {
    mockNodeFetch.mockRejectedValueOnce(new Error('boom'));
    const res = await request(app)
      .post('/api/recognition/analyze')
      .attach('image', Buffer.from('fake'), 'photo.jpg');
    expect(res.status).toBe(500);
  });
});


// ── GET /health ─────────────────────────────────────────────────────
describe('GET /api/recognition/health', () => {
  it('returns both backend + cv_service status when CV is reachable', async () => {
    mockNodeFetch.mockResolvedValueOnce({
      json: async () => ({ status: 'running', outdoor_classes: 50 }),
    });
    const res = await request(app).get('/api/recognition/health');
    expect(res.status).toBe(200);
    expect(res.body.backend).toBe('running');
    expect(res.body.cv_service.outdoor_classes).toBe(50);
  });

  it('returns 503 + cv_service=not running when the CV service is unreachable', async () => {
    mockNodeFetch.mockRejectedValueOnce(new Error('down'));
    const res = await request(app).get('/api/recognition/health');
    expect(res.status).toBe(503);
    expect(res.body.cv_service).toBe('not running');
  });
});
