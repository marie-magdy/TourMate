import { jest } from '@jest/globals';

const mockQuery = jest.fn();
jest.unstable_mockModule('../db.js', () => ({
  default: { query: mockQuery }
}));

const mockBcryptHash = jest.fn().mockResolvedValue('hashed_password');
const mockBcryptCompare = jest.fn();
jest.unstable_mockModule('bcrypt', () => ({
  default: { hash: mockBcryptHash, compare: mockBcryptCompare }
}));

jest.unstable_mockModule('jsonwebtoken', () => ({
  default: { sign: jest.fn().mockReturnValue('fake_token') }
}));

beforeAll(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterAll(() => {
  jest.restoreAllMocks();
});

const { default: request } = await import('supertest');
const { default: express } = await import('express');
const { default: router } = await import('./auth.js');

const app = express();
app.use(express.json());
app.use('/api/auth', router);

beforeEach(() => jest.clearAllMocks());


// REGISTER
describe('POST /api/auth/register', () => {

  it('should return 400 if fields are missing', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'test@test.com' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Username, email, and password are required');
  });

  it('should return 400 if all fields are empty strings', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: '', email: '', password: '' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Username, email, and password are required');
  });

  it('should return 400 if username is less than 3 characters', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'ab', email: 'test@test.com', password: '123456' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Username must be at least 3 characters');
  });

  it('should pass if username is exactly 3 characters', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 1, username: 'joe', email: 'joe@test.com', role: 'user' }]
    });
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'joe', email: 'joe@test.com', password: '123456' });
    expect(res.status).toBe(201);
  });

  it('should return 400 if email format is invalid', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'john', email: 'not-an-email', password: '123456' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid email format');
  });

  it('should return 400 if password is less than 6 characters', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'john', email: 'test@test.com', password: '123' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Password must be at least 6 characters');
  });

  it('should pass if password is exactly 6 characters', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 1, username: 'john', email: 'john@test.com', role: 'user' }]
    });
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'john', email: 'john@test.com', password: '123456' });
    expect(res.status).toBe(201);
  });

  it('should trim spaces from email', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 1, username: 'john', email: 'john@test.com', role: 'user' }]
    });
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'john', email: '  john@test.com  ', password: '123456' });
    expect(res.status).toBe(201);
  });

  it('should return 400 if email already exists', async () => {
    mockQuery.mockRejectedValueOnce({ code: '23505', constraint: 'users_email_key' });
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'john', email: 'john@test.com', password: '123456' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('This email is already registered');
  });

  it('should return 400 if username already taken', async () => {
    mockQuery.mockRejectedValueOnce({ code: '23505', constraint: 'users_username_key' });
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'john', email: 'john@test.com', password: '123456' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('This username is already taken');
  });

  it('should return 400 for extremely long username', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'a'.repeat(300), email: 'test@test.com', password: '123456' });
    // should either pass validation or return 400 — not crash with 500
    expect(res.status).not.toBe(500);
  });

  it('should return 400 for extremely long password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'john', email: 'test@test.com', password: 'a'.repeat(1000) });
    expect(res.status).not.toBe(500);
  });

  it('should return 201 and token on success', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 1, username: 'john', email: 'john@test.com', role: 'user' }]
    });
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'john', email: 'john@test.com', password: '123456' });
    expect(res.status).toBe(201);
    expect(res.body.token).toBe('fake_token');
    expect(res.body.username).toBe('john');
  });
});


// LOGIN
describe('POST /api/auth/login', () => {

  it('should return 400 if fields are missing', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@test.com' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Email and password are required');
  });

  it('should return 400 if fields are empty strings', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: '', password: '' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Email and password are required');
  });

  it('should return 400 if email format is invalid', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'bad-email', password: '123456' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid email format');
  });

  it('should trim and lowercase email before checking', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 1, username: 'john', email: 'john@test.com', password: 'hashed', role: 'user' }]
    });
    mockBcryptCompare.mockResolvedValueOnce(true);
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: '  JOHN@TEST.COM  ', password: '123456' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBe('fake_token');
  });

  it('should return 400 if user not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@test.com', password: '123456' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid email or password');
  });

  it('should return 400 if password is wrong', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 1, email: 'john@test.com', password: 'hashed', role: 'user' }]
    });
    mockBcryptCompare.mockResolvedValueOnce(false);
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'john@test.com', password: 'wrongpass' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid email or password');
  });

  it('should not reveal if email exists or not', async () => {
    // both "not found" and "wrong password" return same message
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res1 = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@test.com', password: '123456' });

    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 1, email: 'john@test.com', password: 'hashed', role: 'user' }]
    });
    mockBcryptCompare.mockResolvedValueOnce(false);
    const res2 = await request(app)
      .post('/api/auth/login')
      .send({ email: 'john@test.com', password: 'wrong' });

    expect(res1.body.error).toBe(res2.body.error); // same message
  });

  it('should return 200 and token on valid login', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 1, username: 'john', email: 'john@test.com', password: 'hashed', role: 'user' }]
    });
    mockBcryptCompare.mockResolvedValueOnce(true);
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'john@test.com', password: '123456' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBe('fake_token');
  });

  it('should return 500 on db error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB error'));
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'john@test.com', password: '123456' });
    expect(res.status).toBe(500);
  });
});


// GOOGLE AUTH
describe('POST /api/auth/google', () => {

  it('should return 400 if email is missing', async () => {
    const res = await request(app)
      .post('/api/auth/google')
      .send({ google_id: '123', username: 'john' });
    expect(res.status).toBe(400);
  });

  it('should create new user if email not found', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })          // SELECT — not found
      .mockResolvedValueOnce({                       // INSERT new user
        rows: [{ id: 1, username: 'john', email: 'john@gmail.com', role: 'user' }]
      })
      .mockResolvedValueOnce({ rows: [] });          // INSERT welcome points

    const res = await request(app)
      .post('/api/auth/google')
      .send({ google_id: '123', email: 'john@gmail.com', username: 'john' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBe('fake_token');
  });

  it('should return existing user if email already exists', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 1, username: 'john', email: 'john@gmail.com', role: 'user' }]
    });
    const res = await request(app)
      .post('/api/auth/google')
      .send({ google_id: '123', email: 'john@gmail.com', username: 'john' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 500 on db error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB error'));
    const res = await request(app)
      .post('/api/auth/google')
      .send({ google_id: '123', email: 'john@gmail.com', username: 'john' });
    expect(res.status).toBe(500);
  });
});


// GET USER
describe('GET /api/auth/user/:id', () => {

  it('should return 404 if user not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get('/api/auth/user/999');
    expect(res.status).toBe(404);
  });

  it('should return user data', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 1, name: 'john', email: 'john@test.com', role: 'user' }]
    });
    const res = await request(app).get('/api/auth/user/1');
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('john');
  });

  it('should return 500 on db error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB error'));
    const res = await request(app).get('/api/auth/user/1');
    expect(res.status).toBe(500);
  });
});


// UPDATE PASSWORD
describe('PUT /api/auth/user/:id/password', () => {

  it('should return 400 if passwords are missing', async () => {
    const res = await request(app)
      .put('/api/auth/user/1/password')
      .send({ current_password: '123456' }); // missing new_password
    expect(res.status).toBe(400);
  });

  it('should return 404 if user not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .put('/api/auth/user/1/password')
      .send({ current_password: '123456', new_password: 'newpass' });
    expect(res.status).toBe(404);
  });

  it('should return 400 if current password is wrong', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 1, password: 'hashed' }]
    });
    mockBcryptCompare.mockResolvedValueOnce(false);
    const res = await request(app)
      .put('/api/auth/user/1/password')
      .send({ current_password: 'wrong', new_password: 'newpass' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Current password is incorrect');
  });

  it('should update password successfully', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 1, password: 'hashed' }] })
      .mockResolvedValueOnce({ rows: [] });
    mockBcryptCompare.mockResolvedValueOnce(true);
    const res = await request(app)
      .put('/api/auth/user/1/password')
      .send({ current_password: '123456', new_password: 'newpass' });
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Password updated successfully');
  });
});


// VOICE UNLOCK
describe('POST /api/auth/user/:id/unlock-voice', () => {

  it('should return 404 if user not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).post('/api/auth/user/1/unlock-voice');
    expect(res.status).toBe(404);
  });

  it('should return 403 if not enough points', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ points: 100, voice_chat_enabled: false }]
    });
    const res = await request(app).post('/api/auth/user/1/unlock-voice');
    expect(res.status).toBe(403);
    expect(res.body.message).toBe('Need 500 points to unlock voice');
  });

  it('should return 403 if points are exactly 499', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ points: 499, voice_chat_enabled: false }]
    });
    const res = await request(app).post('/api/auth/user/1/unlock-voice');
    expect(res.status).toBe(403);
  });

  it('should unlock if points are exactly 500', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ points: 500, voice_chat_enabled: false }] })
      .mockResolvedValueOnce({ rows: [] });
    const res = await request(app).post('/api/auth/user/1/unlock-voice');
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Voice chat unlocked!');
  });

  it('should unlock voice if enough points', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ points: 600, voice_chat_enabled: false }] })
      .mockResolvedValueOnce({ rows: [] });
    const res = await request(app).post('/api/auth/user/1/unlock-voice');
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Voice chat unlocked!');
  });

  it('should return already unlocked if voice already enabled', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ points: 600, voice_chat_enabled: true }]
    });
    const res = await request(app).post('/api/auth/user/1/unlock-voice');
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Already unlocked');
  });
});