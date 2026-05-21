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
const { default: router } = await import('../src/routes/hotels.js');

const app = express();
app.use(express.json());
app.use('/api/hotels', router);

beforeEach(() => jest.clearAllMocks());


describe('GET /api/hotels', () => {
  it('returns all hotels ordered by stars desc, rating desc when no city filter', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 1, name: 'Marriott', city: 'Cairo', stars: 5, rating: 4.8 }],
    });
    const res = await request(app).get('/api/hotels');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);

    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toMatch(/SELECT \* FROM hotels/);
    expect(sql).toMatch(/ORDER BY stars DESC, rating DESC/);
    expect(sql).not.toMatch(/WHERE/);
    expect(params).toEqual([]);
  });

  it('filters by city when ?city= is provided', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await request(app).get('/api/hotels?city=Hurghada');
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toMatch(/WHERE LOWER\(city\) = LOWER\(\$1\)/);
    expect(params).toEqual(['Hurghada']);
  });

  it('returns an empty array when no rows match', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get('/api/hotels?city=Nowhere');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('returns 500 on db error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB error'));
    const res = await request(app).get('/api/hotels');
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});
