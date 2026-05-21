import { jest } from '@jest/globals';

beforeAll(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterAll(() => {
  jest.restoreAllMocks();
});

const { default: request } = await import('supertest');
const { default: express } = await import('express');
const { default: router } = await import('../src/routes/recommendations.js');

const app = express();
app.use(express.json());
app.use('/api/recommendations', router);

// fetch is mocked per-test.
const mockFetch = jest.fn();
beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = mockFetch;
});


// ── GET /attractions (proxy) ────────────────────────────────────────
describe('GET /api/recommendations/attractions', () => {
  it('forwards query params to the recommendation service', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({ success: true, data: [] }),
    });

    await request(app).get('/api/recommendations/attractions?city=Cairo&category=historical');

    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).toContain('city=Cairo');
    expect(calledUrl).toContain('category=historical');
  });

  it('passes through 2xx body from the service unchanged', async () => {
    const payload = { success: true, data: [{ id: 'ATT001', name: 'Pyramids' }] };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(payload),
    });
    const res = await request(app).get('/api/recommendations/attractions?city=Cairo');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(payload);
  });

  it('forwards non-2xx status and error from the service', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      text: async () => JSON.stringify({ error: 'No matches' }),
    });
    const res = await request(app).get('/api/recommendations/attractions?city=Atlantis');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('No matches');
  });

  it('handles invalid JSON body and still surfaces an error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'oops, not JSON',
    });
    const res = await request(app).get('/api/recommendations/attractions');
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });

  it('returns 503 when the recommendation service is unreachable', async () => {
    mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    const res = await request(app).get('/api/recommendations/attractions');
    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/not available/i);
  });
});


// ── GET /health ─────────────────────────────────────────────────────
describe('GET /api/recommendations/health', () => {
  it('returns the upstream health body when reachable', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'ok', attractions: 250 }),
    });
    const res = await request(app).get('/api/recommendations/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.service).toEqual({ status: 'ok', attractions: 250 });
  });

  it('returns 503 when the recommendation service is unreachable', async () => {
    mockFetch.mockRejectedValueOnce(new Error('boom'));
    const res = await request(app).get('/api/recommendations/health');
    expect(res.status).toBe(503);
    expect(res.body.success).toBe(false);
  });
});


// ── POST /itinerary ─────────────────────────────────────────────────
describe('POST /api/recommendations/itinerary', () => {
  it('forwards the request body to the service', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ days: [] }),
    });
    await request(app)
      .post('/api/recommendations/itinerary')
      .send({ city: 'Cairo', budget: 5000 });

    const [_url, opts] = mockFetch.mock.calls[0];
    expect(opts.method).toBe('POST');
    expect(opts.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(opts.body)).toEqual({ city: 'Cairo', budget: 5000 });
  });

  it('wraps the upstream JSON in { success: true, data }', async () => {
    const payload = { days: [{ day: 1, stops: [] }] };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(payload),
    });
    const res = await request(app)
      .post('/api/recommendations/itinerary')
      .send({ city: 'Cairo' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual(payload);
  });

  it('forwards upstream error with status, error, and details', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 422,
      text: async () => JSON.stringify({ error: 'bad budget', details: 'must be > 0' }),
    });
    const res = await request(app)
      .post('/api/recommendations/itinerary')
      .send({ city: 'Cairo', budget: -1 });
    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('bad budget');
    expect(res.body.details).toBe('must be > 0');
  });

  it('returns 503 when the recommendation service is unreachable', async () => {
    mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    const res = await request(app).post('/api/recommendations/itinerary').send({});
    expect(res.status).toBe(503);
  });
});


// ── POST /budget-split ──────────────────────────────────────────────
describe('POST /api/recommendations/budget-split', () => {
  it('returns the fractions when the upstream responds with success', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ fractions: [0.3, 0.4, 0.3] }),
    });
    const res = await request(app)
      .post('/api/recommendations/budget-split')
      .send({ days: 3, budget: 1500 });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.fractions).toEqual([0.3, 0.4, 0.3]);
  });

  it('forwards upstream non-2xx status', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: 'bad request' }),
    });
    const res = await request(app).post('/api/recommendations/budget-split').send({});
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 503 when unreachable', async () => {
    mockFetch.mockRejectedValueOnce(new Error('boom'));
    const res = await request(app).post('/api/recommendations/budget-split').send({});
    expect(res.status).toBe(503);
  });
});
