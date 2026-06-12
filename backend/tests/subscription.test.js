import { jest } from '@jest/globals';

const mockQuery = jest.fn();
jest.unstable_mockModule('../src/db.js', () => ({
  default: { query: mockQuery },
}));

beforeAll(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

const { default: request } = await import('supertest');
const { default: express } = await import('express');
const { default: router } = await import('../src/routes/subscription.js');

const app = express();
app.use(express.json());
app.use('/api/subscription', router);

beforeEach(() => jest.clearAllMocks());

describe('GET /api/subscription/plan', () => {
  it('returns plan info', async () => {
    const res = await request(app).get('/api/subscription/plan');
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe('tourmate_pro');
  });
});

describe('POST /api/subscription/upgrade', () => {
  it('requires user_id', async () => {
    const res = await request(app).post('/api/subscription/upgrade').send({});
    expect(res.status).toBe(400);
  });

  it('rejects card number that is too short', async () => {
    const res = await request(app)
      .post('/api/subscription/upgrade')
      .send({ user_id: 1, card_number: '1111', expiry: '12/30', cvv: '123' });
    expect(res.status).toBe(400);
  });
});
