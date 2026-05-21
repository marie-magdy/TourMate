import { jest } from '@jest/globals';

const mockQuery = jest.fn();
jest.unstable_mockModule('../src/db.js', () => ({
  default: { query: mockQuery }
}));

beforeAll(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterAll(() => {
  jest.restoreAllMocks();
});

const { default: request } = await import('supertest');
const { default: express } = await import('express');
const { default: router } = await import('../src/routes/plans.js');

const app = express();
app.use(express.json());
app.use('/api/plans', router);

// ensureTable() is module-level cached: its CREATE/ALTER calls fire only on
// the FIRST request across this whole file. After that, queue alignment with
// mockResolvedValueOnce(...) breaks. Use mockImplementation that pattern-
// matches by SQL instead, with a per-test overrides bucket.
let overrides = [];

function setEndpoint(pattern, response) {
  overrides.push({ pattern, response });
}

beforeEach(() => {
  jest.clearAllMocks();
  overrides = [];
  mockQuery.mockImplementation((sql) => {
    // ensureTable: CREATE TABLE + ALTER TABLE — return empty so init succeeds.
    if (/CREATE TABLE|ALTER TABLE/i.test(String(sql))) {
      return Promise.resolve({ rows: [] });
    }
    for (let i = 0; i < overrides.length; i++) {
      if (overrides[i].pattern.test(String(sql))) {
        const r = overrides.splice(i, 1)[0].response;
        return r instanceof Error ? Promise.reject(r) : Promise.resolve(r);
      }
    }
    return Promise.resolve({ rows: [] });
  });
});


// ── POST / ──────────────────────────────────────────────────────────
describe('POST /api/plans', () => {
  it('returns 400 if user_id is missing', async () => {
    const res = await request(app).post('/api/plans').send({ itinerary: [] });
    expect(res.status).toBe(400);
  });

  it('returns 400 if itinerary is missing', async () => {
    const res = await request(app).post('/api/plans').send({ user_id: 1 });
    expect(res.status).toBe(400);
  });

  it('saves a plan and returns id + created_at', async () => {
    setEndpoint(/INSERT INTO saved_plans/, { rows: [{ id: 7, created_at: '2026-01-01' }] });

    const res = await request(app)
      .post('/api/plans')
      .send({
        user_id: 1, city: 'Cairo',
        start_date: '2026-01-01', end_date: '2026-01-03',
        budget: '5000', day_hours: '8',
        interests: ['historical'], spot_ids: ['ATT001'],
        itinerary: [{ day: 1, stops: [] }],
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(7);
  });

  it('JSON-stringifies interests/spot_ids/itinerary in the INSERT params', async () => {
    setEndpoint(/INSERT INTO saved_plans/, { rows: [{ id: 1, created_at: 'x' }] });

    await request(app).post('/api/plans').send({
      user_id: 1, itinerary: [{ day: 1 }],
      interests: ['a', 'b'], spot_ids: ['ATT001'],
    });

    const insert = mockQuery.mock.calls.find(c => /INSERT INTO saved_plans/.test(String(c[0])));
    expect(insert).toBeDefined();
    const params = insert[1];
    expect(params[6]).toBe('["a","b"]');
    expect(params[7]).toBe('["ATT001"]');
    expect(params[8]).toBe('[{"day":1}]');
    expect(params[9]).toBeNull(); // flight_details default
    expect(params[10]).toBeNull(); // hotel_details default
  });

  it('returns 500 on db error', async () => {
    setEndpoint(/INSERT INTO saved_plans/, new Error('DB error'));
    const res = await request(app)
      .post('/api/plans')
      .send({ user_id: 1, itinerary: [] });
    expect(res.status).toBe(500);
  });
});


// ── GET /item/:planId ───────────────────────────────────────────────
describe('GET /api/plans/item/:planId', () => {
  it('returns 404 if not found', async () => {
    setEndpoint(/SELECT id, user_id[\s\S]*FROM saved_plans WHERE id/i, { rowCount: 0, rows: [] });
    const res = await request(app).get('/api/plans/item/999');
    expect(res.status).toBe(404);
  });

  it('returns the plan when found', async () => {
    setEndpoint(/SELECT id, user_id[\s\S]*FROM saved_plans WHERE id/i, {
      rowCount: 1,
      rows: [{ id: 5, city: 'Cairo', itinerary: [] }],
    });
    const res = await request(app).get('/api/plans/item/5');
    expect(res.status).toBe(200);
    expect(res.body.data.city).toBe('Cairo');
  });
});


// ── PUT /item/:planId ───────────────────────────────────────────────
describe('PUT /api/plans/item/:planId', () => {
  it('returns 400 if itinerary is missing', async () => {
    const res = await request(app)
      .put('/api/plans/item/5')
      .send({ city: 'Cairo' });
    expect(res.status).toBe(400);
  });

  it('returns 404 if plan not found', async () => {
    setEndpoint(/UPDATE saved_plans/, { rowCount: 0, rows: [] });
    const res = await request(app)
      .put('/api/plans/item/999')
      .send({ itinerary: [] });
    expect(res.status).toBe(404);
  });

  it('updates the plan and returns id/created_at', async () => {
    setEndpoint(/UPDATE saved_plans/, { rowCount: 1, rows: [{ id: 5, created_at: 'x' }] });
    const res = await request(app)
      .put('/api/plans/item/5')
      .send({ itinerary: [{ day: 1 }] });
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(5);
  });

  it('passes day_hours as a string through when already a string', async () => {
    setEndpoint(/UPDATE saved_plans/, { rowCount: 1, rows: [{ id: 5, created_at: 'x' }] });

    await request(app)
      .put('/api/plans/item/5')
      .send({ itinerary: [{}], day_hours: '8' });

    const update = mockQuery.mock.calls.find(c => /UPDATE saved_plans/.test(String(c[0])));
    expect(update[1][4]).toBe('8');
  });

  it('JSON-stringifies day_hours when an array is given', async () => {
    setEndpoint(/UPDATE saved_plans/, { rowCount: 1, rows: [{ id: 5, created_at: 'x' }] });

    await request(app)
      .put('/api/plans/item/5')
      .send({ itinerary: [{}], day_hours: [8, 8, 6] });

    const update = mockQuery.mock.calls.find(c => /UPDATE saved_plans/.test(String(c[0])));
    expect(update[1][4]).toBe('[8,8,6]');
  });
});


// ── GET /:user_id (list) ────────────────────────────────────────────
describe('GET /api/plans/:user_id', () => {
  it('returns the list of saved plans for a user', async () => {
    setEndpoint(/SELECT id, city[\s\S]*FROM saved_plans WHERE user_id/i, {
      rows: [{ id: 1, city: 'Cairo' }],
    });
    const res = await request(app).get('/api/plans/42');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  it('returns 500 on db error', async () => {
    setEndpoint(/SELECT id, city[\s\S]*FROM saved_plans WHERE user_id/i, new Error('DB error'));
    const res = await request(app).get('/api/plans/42');
    expect(res.status).toBe(500);
  });
});


// ── PATCH /item/:planId/name ────────────────────────────────────────
describe('PATCH /api/plans/item/:planId/name', () => {
  it('returns 400 when name is empty or whitespace', async () => {
    const r1 = await request(app).patch('/api/plans/item/5/name').send({ name: '' });
    expect(r1.status).toBe(400);
    const r2 = await request(app).patch('/api/plans/item/5/name').send({ name: '   ' });
    expect(r2.status).toBe(400);
  });

  it('returns 404 when plan not found', async () => {
    setEndpoint(/UPDATE saved_plans SET name/, { rowCount: 0, rows: [] });
    const res = await request(app).patch('/api/plans/item/999/name').send({ name: 'My Trip' });
    expect(res.status).toBe(404);
  });

  it('trims the name and updates', async () => {
    setEndpoint(/UPDATE saved_plans SET name/, { rowCount: 1, rows: [{ id: 5, name: 'My Trip' }] });
    const res = await request(app)
      .patch('/api/plans/item/5/name')
      .send({ name: '  My Trip  ' });
    expect(res.status).toBe(200);
    const update = mockQuery.mock.calls.find(c => /UPDATE saved_plans SET name/.test(String(c[0])));
    expect(update[1][0]).toBe('My Trip');
  });
});


// ── DELETE /:id ─────────────────────────────────────────────────────
describe('DELETE /api/plans/:id', () => {
  it('returns 404 when plan not found', async () => {
    setEndpoint(/DELETE FROM saved_plans/, { rowCount: 0, rows: [] });
    const res = await request(app).delete('/api/plans/999');
    expect(res.status).toBe(404);
  });

  it('deletes the plan', async () => {
    setEndpoint(/DELETE FROM saved_plans/, { rowCount: 1, rows: [{ id: 5 }] });
    const res = await request(app).delete('/api/plans/5');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
