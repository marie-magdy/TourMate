import { jest } from '@jest/globals';

// Mock pool
const mockQuery = jest.fn();
jest.unstable_mockModule('../src/db.js', () => ({
  default: { query: mockQuery }
}));

// ⚠️ Imports MUST come after mocks
const { default: request } = await import('supertest');
const { default: express } = await import('express');
const { default: router } = await import('../src/routes/admin.js');

const app = express();
app.use(express.json());
app.use('/api/auth', router);

beforeEach(() => jest.clearAllMocks());


// ─────────────────────────────────────────
// GET ALL USERS
// ─────────────────────────────────────────
describe('GET /api/auth/admin/users', () => {

  it('should return all users', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: 1, username: 'john', email: 'john@test.com', role: 'user', points: 100 },
        { id: 2, username: 'jane', email: 'jane@test.com', role: 'admin', points: 200 },
      ]
    });

    const res = await request(app).get('/api/auth/admin/users');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(2);
  });

  it('should return 500 on db error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB error'));

    const res = await request(app).get('/api/auth/admin/users');
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});


// ─────────────────────────────────────────
// DELETE USER
// ─────────────────────────────────────────
describe('DELETE /api/auth/admin/users/:id', () => {

  it('should delete user and related data', async () => {
    // 4 queries: favorites, user_points, points_history, users
    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // DELETE favorites
      .mockResolvedValueOnce({ rows: [] }) // DELETE user_points
      .mockResolvedValueOnce({ rows: [] }) // DELETE points_history
      .mockResolvedValueOnce({ rows: [] }); // DELETE users

    const res = await request(app).delete('/api/auth/admin/users/1');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('User deleted');
  });

  it('should return 500 on db error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB error'));

    const res = await request(app).delete('/api/auth/admin/users/1');
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });

    it('should return 500 if user does not exist', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB error'));
    const res = await request(app).delete('/api/auth/admin/users/999');
    expect(res.status).toBe(500);
  });
});


// ─────────────────────────────────────────
// UPDATE USER ROLE
// ─────────────────────────────────────────
describe('PUT /api/auth/admin/users/:id/role', () => {

  it('should return 400 if role is invalid', async () => {
    const res = await request(app)
      .put('/api/auth/admin/users/1/role')
      .send({ role: 'superuser' }); // invalid role

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Invalid role');
  });

  it('should update role to admin', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .put('/api/auth/admin/users/1/role')
      .send({ role: 'admin' });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('User role updated to admin');
  });

  it('should update role to user', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .put('/api/auth/admin/users/1/role')
      .send({ role: 'user' });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('User role updated to user');
  });
   it('should return 400 if role field is missing', async () => {
    const res = await request(app)
      .put('/api/auth/admin/users/1/role')
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Invalid role');
  });
});


// ─────────────────────────────────────────
// ADD POINTS
// ─────────────────────────────────────────
describe('POST /api/auth/admin/users/:id/points', () => {

  it('should add points successfully', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // INSERT user_points
      .mockResolvedValueOnce({ rows: [] }); // INSERT points_history

    const res = await request(app)
      .post('/api/auth/admin/users/1/points')
      .send({ points: 100, reason: 'Bonus' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('Points added');
  });

  it('should use default reason if none provided', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/auth/admin/users/1/points')
      .send({ points: 50 }); // no reason

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 500 on db error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB error'));

    const res = await request(app)
      .post('/api/auth/admin/users/1/points')
      .send({ points: 100 });

    expect(res.status).toBe(500);
  });

    it('should return 400 if points are negative', async () => {
    const res = await request(app)
      .post('/api/auth/admin/users/1/points')
      .send({ points: -50, reason: 'Penalty' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Points cannot be negative');
  });

  it('should return 400 if points field is missing', async () => {
    const res = await request(app)
      .post('/api/auth/admin/users/1/points')
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Points must be a number');
  });
});


// ─────────────────────────────────────────
// GET STATS
// ─────────────────────────────────────────
describe('GET /api/auth/admin/stats', () => {

  it('should return all stats', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ count: '10' }] })  // total users
      .mockResolvedValueOnce({ rows: [{ count: '5' }] })   // total attractions
      .mockResolvedValueOnce({ rows: [{ count: '20' }] })  // total favorites
      .mockResolvedValueOnce({ rows: [{ total: '1500' }] }) // total points
      .mockResolvedValueOnce({ rows: [              // top attractions
        { name: 'Pyramids', city: 'Cairo', favorites: '10' }
      ]});

    const res = await request(app).get('/api/auth/admin/stats');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.total_users).toBe(10);
    expect(res.body.data.total_attractions).toBe(5);
    expect(res.body.data.total_favorites).toBe(20);
    expect(res.body.data.total_points).toBe(1500);
    expect(res.body.data.top_attractions).toHaveLength(1);
  });

  it('should return zeros if db fails', async () => {
    mockQuery.mockRejectedValue(new Error('DB error'));

    const res = await request(app).get('/api/auth/admin/stats');
    expect(res.status).toBe(200); // safeCount never throws
    expect(res.body.data.total_users).toBe(0);
  });
});


// ─────────────────────────────────────────
// VOICE ACCESS
// ─────────────────────────────────────────
describe('PUT /api/auth/admin/users/:id/voice-access', () => {

  it('should return 400 if enabled is not boolean', async () => {
    const res = await request(app)
      .put('/api/auth/admin/users/1/voice-access')
      .send({ enabled: 'yes' }); // string not boolean

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('enabled must be boolean');
  });

  it('should enable voice access', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .put('/api/auth/admin/users/1/voice-access')
      .send({ enabled: true });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Voice access enabled');
  });

  it('should disable voice access', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .put('/api/auth/admin/users/1/voice-access')
      .send({ enabled: false });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Voice access disabled');
  });
  
    it('should return 400 if enabled field is missing', async () => {
    const res = await request(app)
      .put('/api/auth/admin/users/1/voice-access')
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('enabled must be boolean');
  });

  it('should return 400 if enabled is a string "true"', async () => {
    const res = await request(app)
      .put('/api/auth/admin/users/1/voice-access')
      .send({ enabled: 'true' });
    expect(res.status).toBe(400);
  });
});

describe('PUT /api/auth/admin/users/:id/features', () => {
  it('updates feature flags', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .put('/api/auth/admin/users/2/features')
      .send({ is_pro: true, cv_enabled: true });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 400 when no flags provided', async () => {
    const res = await request(app)
      .put('/api/auth/admin/users/2/features')
      .send({});
    expect(res.status).toBe(400);
  });
});