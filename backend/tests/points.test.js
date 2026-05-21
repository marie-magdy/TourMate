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
const { default: router } = await import('../src/routes/points.js');

const app = express();
app.use(express.json());
app.use('/api/points', router);

beforeEach(() => jest.clearAllMocks());


// ── GET /rewards/all ────────────────────────────────────────────────
describe('GET /api/points/rewards/all', () => {
  it('returns all available rewards', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 1, title: 'Free coffee', points_required: 100 }],
    });
    const res = await request(app).get('/api/points/rewards/all');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  it('returns 500 on db error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB error'));
    const res = await request(app).get('/api/points/rewards/all');
    expect(res.status).toBe(500);
  });
});


// ── GET /:user_id ───────────────────────────────────────────────────
describe('GET /api/points/:user_id', () => {
  it('returns existing user points', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ user_id: 1, points: 250, total_earned: 500 }],
    });
    const res = await request(app).get('/api/points/1');
    expect(res.status).toBe(200);
    expect(res.body.data.points).toBe(250);
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  it('creates a new row with 0 points when none exists', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ user_id: 1, points: 0, total_earned: 0 }] });
    const res = await request(app).get('/api/points/1');
    expect(res.status).toBe(200);
    expect(res.body.data.points).toBe(0);
    expect(mockQuery.mock.calls[1][0]).toMatch(/INSERT INTO user_points/);
  });

  it('returns 500 on db error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB error'));
    const res = await request(app).get('/api/points/1');
    expect(res.status).toBe(500);
  });
});


// ── GET /:user_id/history ───────────────────────────────────────────
describe('GET /api/points/:user_id/history', () => {
  it('returns user points history', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 1, points: 50, action: 'earn' }],
    });
    const res = await request(app).get('/api/points/1/history');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    const sql = mockQuery.mock.calls[0][0];
    expect(sql).toMatch(/ORDER BY created_at DESC/);
    expect(sql).toMatch(/LIMIT 20/);
  });

  it('returns 500 on db error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB error'));
    const res = await request(app).get('/api/points/1/history');
    expect(res.status).toBe(500);
  });
});


// ── POST /earn ──────────────────────────────────────────────────────
describe('POST /api/points/earn', () => {
  it('returns 400 if user_id is missing', async () => {
    const res = await request(app)
      .post('/api/points/earn')
      .send({ points: 10, action: 'login' });
    expect(res.status).toBe(400);
  });

  it('returns 400 if points is missing or 0', async () => {
    const res = await request(app)
      .post('/api/points/earn')
      .send({ user_id: 1, action: 'login' });
    expect(res.status).toBe(400);
  });

  it('returns 400 if action is missing', async () => {
    const res = await request(app)
      .post('/api/points/earn')
      .send({ user_id: 1, points: 10 });
    expect(res.status).toBe(400);
  });

  it('upserts points and writes a history row', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })  // upsert
      .mockResolvedValueOnce({ rows: [] })  // history insert
      .mockResolvedValueOnce({ rows: [{ user_id: 1, points: 110 }] }); // re-select

    const res = await request(app)
      .post('/api/points/earn')
      .send({ user_id: 1, points: 10, action: 'login', description: 'daily login' });

    expect(res.status).toBe(200);
    expect(res.body.data.points).toBe(110);
    expect(mockQuery.mock.calls[0][0]).toMatch(/INSERT INTO user_points/);
    expect(mockQuery.mock.calls[1][0]).toMatch(/INSERT INTO points_history/);
  });

  it('returns 500 on db error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB error'));
    const res = await request(app)
      .post('/api/points/earn')
      .send({ user_id: 1, points: 10, action: 'login' });
    expect(res.status).toBe(500);
  });
});


// ── POST /redeem ────────────────────────────────────────────────────
describe('POST /api/points/redeem', () => {
  it('returns 404 if reward not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .post('/api/points/redeem')
      .send({ user_id: 1, reward_id: 999 });
    expect(res.status).toBe(404);
  });

  it('returns 400 when user has no points row', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 1, points_required: 100, title: 'X' }] })
      .mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .post('/api/points/redeem')
      .send({ user_id: 1, reward_id: 1 });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Not enough points');
  });

  it('returns 400 when user has fewer points than required', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 1, points_required: 500, title: 'Big' }] })
      .mockResolvedValueOnce({ rows: [{ user_id: 1, points: 100 }] });
    const res = await request(app)
      .post('/api/points/redeem')
      .send({ user_id: 1, reward_id: 1 });
    expect(res.status).toBe(400);
  });

  it('allows redemption when points exactly equal points_required', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 1, points_required: 100, title: 'Coffee' }] })
      .mockResolvedValueOnce({ rows: [{ user_id: 1, points: 100 }] })
      .mockResolvedValueOnce({ rows: [] }) // UPDATE
      .mockResolvedValueOnce({ rows: [] }) // history
      .mockResolvedValueOnce({ rows: [{ user_id: 1, points: 0 }] });

    const res = await request(app)
      .post('/api/points/redeem')
      .send({ user_id: 1, reward_id: 1 });

    expect(res.status).toBe(200);
    expect(res.body.data.points).toBe(0);
    expect(res.body.reward.title).toBe('Coffee');
  });

  it('records a negative-points entry in history on redeem', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 1, points_required: 100, title: 'Coffee' }] })
      .mockResolvedValueOnce({ rows: [{ user_id: 1, points: 200 }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ user_id: 1, points: 100 }] });

    await request(app)
      .post('/api/points/redeem')
      .send({ user_id: 1, reward_id: 1 });

    const historyCall = mockQuery.mock.calls.find(c =>
      String(c[0]).includes('INSERT INTO points_history'),
    );
    expect(historyCall[1][1]).toBe(-100);
    expect(historyCall[1][2]).toBe('redeem');
  });

  it('returns 500 on db error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB error'));
    const res = await request(app)
      .post('/api/points/redeem')
      .send({ user_id: 1, reward_id: 1 });
    expect(res.status).toBe(500);
  });
});
