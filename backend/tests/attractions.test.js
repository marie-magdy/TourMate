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
const { default: router } = await import('../src/routes/attractions.js');

const app = express();
app.use(express.json({ limit: '5mb' }));
app.use('/api/attractions', router);

beforeEach(() => jest.clearAllMocks());


// ── GET /popular ────────────────────────────────────────────────────
describe('GET /api/attractions/popular', () => {
  it('returns popular attractions with success=true', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 1, name: 'Pyramids', city: 'Giza', rating: 4.8 }],
    });
    const res = await request(app).get('/api/attractions/popular');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe('Pyramids');
  });

  it('returns 500 on db error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB error'));
    const res = await request(app).get('/api/attractions/popular');
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});


// ── GET /nearest ────────────────────────────────────────────────────
describe('GET /api/attractions/nearest', () => {
  it('uses coords-based query when lat/lon are valid', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Spot' }] });
    const res = await request(app).get('/api/attractions/nearest?lat=30.05&lon=31.25');
    expect(res.status).toBe(200);
    const params = mockQuery.mock.calls[0][1];
    expect(params[0]).toBe(30.05);
    expect(params[1]).toBe(31.25);
  });

  it('appends city filter to coords query when both provided', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await request(app).get('/api/attractions/nearest?lat=30&lon=31&city=Cairo');
    expect(mockQuery.mock.calls[0][1]).toContain('Cairo');
  });

  it('falls back to city-only query when coords are missing', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await request(app).get('/api/attractions/nearest?city=Alexandria');
    const sql = mockQuery.mock.calls[0][0];
    expect(sql).toMatch(/LOWER\(ci\.name\)/);
    expect(mockQuery.mock.calls[0][1]).toEqual(['Alexandria']);
  });

  it('falls back to Alexandria when no city and no coords are provided', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await request(app).get('/api/attractions/nearest');
    expect(mockQuery.mock.calls[0][1]).toEqual(['Alexandria']);
  });

  it('caps the limit at 50', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await request(app).get('/api/attractions/nearest?city=Cairo&limit=9999');
    expect(mockQuery.mock.calls[0][0]).toMatch(/LIMIT 50/);
  });

  it('clamps the limit to at least 1', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await request(app).get('/api/attractions/nearest?city=Cairo&limit=0');
    expect(mockQuery.mock.calls[0][0]).toMatch(/LIMIT 1/);
  });

  it('ignores non-numeric lat/lon and uses city fallback', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await request(app).get('/api/attractions/nearest?lat=abc&lon=xyz&city=Cairo');
    expect(mockQuery.mock.calls[0][1]).toEqual(['Cairo']);
  });

  it('returns 500 on db error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB error'));
    const res = await request(app).get('/api/attractions/nearest?city=Cairo');
    expect(res.status).toBe(500);
  });
});


// ── GET /search ─────────────────────────────────────────────────────
describe('GET /api/attractions/search', () => {
  it('returns empty array when q is missing', async () => {
    const res = await request(app).get('/api/attractions/search');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('runs ILIKE search when q is provided', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Pyramids' }] });
    const res = await request(app).get('/api/attractions/search?q=pyramids');
    expect(res.status).toBe(200);
    expect(mockQuery.mock.calls[0][1]).toEqual(['%pyramids%']);
  });

  it('returns 500 on db error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB error'));
    const res = await request(app).get('/api/attractions/search?q=x');
    expect(res.status).toBe(500);
  });
});


// ── GET /favorites/:user_id ─────────────────────────────────────────
describe('GET /api/attractions/favorites/:user_id', () => {
  it('returns user favorites', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Saved' }] });
    const res = await request(app).get('/api/attractions/favorites/42');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(mockQuery.mock.calls[0][1]).toEqual(['42']);
  });

  it('returns 500 on db error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB error'));
    const res = await request(app).get('/api/attractions/favorites/1');
    expect(res.status).toBe(500);
  });
});


// ── GET / (list) ────────────────────────────────────────────────────
describe('GET /api/attractions', () => {
  it('filters by city when ?city=', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await request(app).get('/api/attractions?city=Cairo');
    expect(mockQuery.mock.calls[0][1]).toEqual(['Cairo']);
  });

  it('ignores category=all', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await request(app).get('/api/attractions?city=Cairo&category=all');
    expect(mockQuery.mock.calls[0][1]).toEqual(['Cairo']);
  });

  it('filters by category when specified', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await request(app).get('/api/attractions?category=historical');
    expect(mockQuery.mock.calls[0][1]).toEqual(['historical']);
  });

  it('returns 500 on db error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB error'));
    const res = await request(app).get('/api/attractions');
    expect(res.status).toBe(500);
  });
});


// ── GET /:id/images ─────────────────────────────────────────────────
describe('GET /api/attractions/:id/images', () => {
  it('returns images for an attraction', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 1, image_url: 'a.jpg', is_primary: true }],
    });
    const res = await request(app).get('/api/attractions/5/images');
    expect(res.status).toBe(200);
    expect(res.body.data[0].is_primary).toBe(true);
  });

  it('returns 500 on db error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB error'));
    const res = await request(app).get('/api/attractions/5/images');
    expect(res.status).toBe(500);
  });
});


// ── GET /:id ────────────────────────────────────────────────────────
describe('GET /api/attractions/:id', () => {
  it('looks up by integer id when id is numeric', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 5, name: 'Spot' }] });
    const res = await request(app).get('/api/attractions/5');
    expect(res.status).toBe(200);
    expect(mockQuery.mock.calls[0][0]).toMatch(/a\.id = \$1/);
    expect(mockQuery.mock.calls[0][1]).toEqual([5]);
  });

  it('looks up by attraction_id when id is non-numeric', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 1, attraction_id: 'ATT062' }] });
    const res = await request(app).get('/api/attractions/ATT062');
    expect(res.status).toBe(200);
    expect(mockQuery.mock.calls[0][0]).toMatch(/a\.attraction_id = \$1/);
    expect(mockQuery.mock.calls[0][1]).toEqual(['ATT062']);
  });

  it('returns 404 when not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get('/api/attractions/999');
    expect(res.status).toBe(404);
  });

  it('returns 500 on db error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB error'));
    const res = await request(app).get('/api/attractions/5');
    expect(res.status).toBe(500);
  });
});


// ── POST / ──────────────────────────────────────────────────────────
describe('POST /api/attractions', () => {
  it('returns 400 if name or city missing', async () => {
    const res = await request(app).post('/api/attractions').send({ name: 'X' });
    expect(res.status).toBe(400);
  });

  it('creates an attraction and links categories + images', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ city_id: 1 }] })            // city lookup
      .mockResolvedValueOnce({ rows: [{ id: 100, name: 'Spot' }] }) // insert attraction
      .mockResolvedValueOnce({ rows: [{ category_id: 7 }] })        // category lookup
      .mockResolvedValueOnce({ rows: [] })                           // insert category link
      .mockResolvedValueOnce({ rows: [] });                          // insert image

    const res = await request(app)
      .post('/api/attractions')
      .send({
        name: 'Spot',
        city: 'Cairo',
        categories: ['historical'],
        images: ['https://x/y.jpg'],
      });

    expect(res.status).toBe(201);
    expect(res.body.data.id).toBe(100);
  });

  it('skips category insert when category lookup returns no row', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ city_id: 1 }] })
      .mockResolvedValueOnce({ rows: [{ id: 100 }] })
      .mockResolvedValueOnce({ rows: [] }); // unknown category
    const res = await request(app)
      .post('/api/attractions')
      .send({ name: 'Spot', city: 'Cairo', categories: ['notreal'] });
    expect(res.status).toBe(201);
    expect(mockQuery).toHaveBeenCalledTimes(3);
  });

  it('returns 500 on db error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB error'));
    const res = await request(app)
      .post('/api/attractions')
      .send({ name: 'X', city: 'Y' });
    expect(res.status).toBe(500);
  });
});


// ── PUT /:id ────────────────────────────────────────────────────────
describe('PUT /api/attractions/:id', () => {
  it('returns 404 if attraction not found', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ city_id: 1 }] }) // city lookup
      .mockResolvedValueOnce({ rows: [] });               // update returned no rows
    const res = await request(app)
      .put('/api/attractions/999')
      .send({ name: 'X', city: 'Cairo' });
    expect(res.status).toBe(404);
  });

  it('updates an attraction', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ city_id: 1 }] })
      .mockResolvedValueOnce({ rows: [{ id: 5, name: 'New' }] });
    const res = await request(app)
      .put('/api/attractions/5')
      .send({ name: 'New', city: 'Cairo' });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('New');
  });

  it('converts Google Drive URLs when saving images', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ city_id: 1 }] })
      .mockResolvedValueOnce({ rows: [{ id: 5 }] })
      .mockResolvedValueOnce({ rows: [] }) // delete images
      .mockResolvedValueOnce({ rows: [] });// insert image

    await request(app)
      .put('/api/attractions/5')
      .send({
        name: 'X',
        city: 'Cairo',
        images: ['https://drive.google.com/file/d/abc123/view'],
      });

    const imageInsertCall = mockQuery.mock.calls.find(c =>
      String(c[0]).includes('INSERT INTO attraction_images'),
    );
    expect(imageInsertCall[1][1]).toBe(
      'https://drive.google.com/uc?export=view&id=abc123',
    );
  });

  it('returns 500 on db error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB error'));
    const res = await request(app)
      .put('/api/attractions/5')
      .send({ name: 'X', city: 'Y' });
    expect(res.status).toBe(500);
  });
});


// ── DELETE /:id ─────────────────────────────────────────────────────
describe('DELETE /api/attractions/:id', () => {
  it('cascades deletes through categories, images, favorites, then attraction', async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    const res = await request(app).delete('/api/attractions/5');
    expect(res.status).toBe(200);
    expect(mockQuery).toHaveBeenCalledTimes(4);
    const sqls = mockQuery.mock.calls.map(c => c[0]);
    expect(sqls[0]).toMatch(/attraction_categories/);
    expect(sqls[1]).toMatch(/attraction_images/);
    expect(sqls[2]).toMatch(/favorites/);
    expect(sqls[3]).toMatch(/attractions/);
  });

  it('returns 500 on db error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB error'));
    const res = await request(app).delete('/api/attractions/5');
    expect(res.status).toBe(500);
  });
});


// ── POST /:id/favorite ──────────────────────────────────────────────
describe('POST /api/attractions/:id/favorite', () => {
  it('returns 400 if user_id is missing', async () => {
    const res = await request(app).post('/api/attractions/5/favorite').send({});
    expect(res.status).toBe(400);
  });

  it('adds a favorite when none exists', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })  // SELECT existing
      .mockResolvedValueOnce({ rows: [] }); // INSERT
    const res = await request(app)
      .post('/api/attractions/5/favorite')
      .send({ user_id: 42 });
    expect(res.status).toBe(200);
    expect(res.body.favorited).toBe(true);
    expect(mockQuery.mock.calls[1][0]).toMatch(/INSERT INTO favorites/);
  });

  it('removes the favorite when it already exists', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // SELECT existing
      .mockResolvedValueOnce({ rows: [] });          // DELETE
    const res = await request(app)
      .post('/api/attractions/5/favorite')
      .send({ user_id: 42 });
    expect(res.status).toBe(200);
    expect(res.body.favorited).toBe(false);
    expect(mockQuery.mock.calls[1][0]).toMatch(/DELETE FROM favorites/);
  });

  it('returns 500 on db error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB error'));
    const res = await request(app)
      .post('/api/attractions/5/favorite')
      .send({ user_id: 42 });
    expect(res.status).toBe(500);
  });
});


// ── POST /upload-image ──────────────────────────────────────────────
describe('POST /api/attractions/upload-image', () => {
  it('returns 400 when image is missing', async () => {
    const res = await request(app).post('/api/attractions/upload-image').send({});
    expect(res.status).toBe(400);
  });
});


// ── POST /download-images ───────────────────────────────────────────
describe('POST /api/attractions/download-images', () => {
  it('returns 400 when urls list is missing/empty', async () => {
    const empty = await request(app).post('/api/attractions/download-images').send({ urls: [] });
    expect(empty.status).toBe(400);

    const missing = await request(app).post('/api/attractions/download-images').send({});
    expect(missing.status).toBe(400);
  });
});
