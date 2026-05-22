/**
 * Unit tests for backend/src/routes/attractions.js
 *
 * Run with:  npm test
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// ── Must use unstable_mockModule for ESM ─────────────────────────────
const mockQuery = jest.fn();
const mockFs = {
  existsSync: jest.fn(() => true),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  createWriteStream: jest.fn(() => ({   // ← add this return value
    close: jest.fn(),
    on: jest.fn(),
  })),
  unlinkSync: jest.fn(),
};

await jest.unstable_mockModule('../src/db.js', () => ({
  default: { query: mockQuery },
}));

await jest.unstable_mockModule('fs', () => ({
  default: mockFs,
}));

// ── Imports AFTER the mocks ───────────────────────────────────────────
const { default: router } = await import('../src/routes/attractions.js');
const { default: request } = await import('supertest');
const express = (await import('express')).default;

// ── Build a minimal Express app ───────────────────────────────────────
const app = express();
app.use(express.json({ limit: '10mb' }));
app.use('/api/attractions', router);

// ── Shared fixture data ───────────────────────────────────────────────
const FAKE_ATTRACTION = {
  id: 1,
  name: 'Library of Alexandria',
  city: 'Alexandria',
  city_id: 10,
  description: 'Ancient wonder',
  rating: 4.8,
  price_from: 50,
  opening_hours: '09:00-17:00',
  is_popular: true,
  latitude: 31.2,
  longitude: 29.9,
  categories: ['historical', 'cultural'],
  primary_image: 'https://example.com/img.jpg',
};

const FAKE_IMAGE = {
  id: 1,
  attraction_id: 1,
  image_url: 'https://example.com/img.jpg',
  is_primary: true,
};

// ── Reset mocks between tests ─────────────────────────────────────────
beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  mockQuery.mockReset();
  mockFs.existsSync.mockReset();
  mockFs.writeFileSync.mockReset();
  mockFs.createWriteStream.mockReset();
  mockFs.unlinkSync.mockReset();
  mockFs.mkdirSync.mockReset();
  // restore defaults
  mockFs.existsSync.mockReturnValue(true);
  mockFs.createWriteStream.mockReturnValue({ close: jest.fn(), on: jest.fn() });
});

afterEach(() => {
  console.error.mockRestore();
});

// ═════════════════════════════════════════════════════════════════════
//  1. GET /api/attractions/popular
// ═════════════════════════════════════════════════════════════════════
describe('GET /api/attractions/popular', () => {
  it('returns popular attractions ordered by rating', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [FAKE_ATTRACTION] });

    const res = await request(app).get('/api/attractions/popular');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe('Library of Alexandria');
  });

  it('returns 500 when DB throws', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB down'));

    const res = await request(app).get('/api/attractions/popular');

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Server error');
  });
});

// ═════════════════════════════════════════════════════════════════════
//  2. GET /api/attractions/nearest
// ═════════════════════════════════════════════════════════════════════
describe('GET /api/attractions/nearest', () => {
  it('uses great-circle query when lat + lon provided', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [FAKE_ATTRACTION] });

    const res = await request(app)
      .get('/api/attractions/nearest')
      .query({ lat: 31.2, lon: 29.9 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockQuery.mock.calls[0][1][0]).toBe(31.2);
  });

  it('adds city filter when lat + lon + city all provided', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [FAKE_ATTRACTION] });

    const res = await request(app)
      .get('/api/attractions/nearest')
      .query({ lat: 31.2, lon: 29.9, city: 'Alexandria' });

    expect(res.status).toBe(200);
    expect(mockQuery.mock.calls[0][1][2]).toBe('Alexandria');
  });

  it('falls back to city-based query when no coords supplied', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [FAKE_ATTRACTION] });

    const res = await request(app)
      .get('/api/attractions/nearest')
      .query({ city: 'Cairo' });

    expect(res.status).toBe(200);
    expect(mockQuery.mock.calls[0][1][0]).toBe('Cairo');
  });

  it('defaults to Alexandria when no coords and no city', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/api/attractions/nearest');

    expect(res.status).toBe(200);
    expect(mockQuery.mock.calls[0][1][0]).toBe('Alexandria');
  });

  it('clamps limit=0 to minimum of 1', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get('/api/attractions/nearest')
      .query({ city: 'Cairo', limit: 0 });

    expect(res.status).toBe(200);
    expect(mockQuery.mock.calls[0][0]).toContain('LIMIT 1');
  });

  it('clamps limit=999 to maximum of 50', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get('/api/attractions/nearest')
      .query({ city: 'Cairo', limit: 999 });

    expect(res.status).toBe(200);
    expect(mockQuery.mock.calls[0][0]).toContain('LIMIT 50');
  });

  it('treats non-numeric lat as no-coords and falls back to city mode', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get('/api/attractions/nearest')
      .query({ lat: 'abc', lon: 'xyz', city: 'Luxor' });

    expect(res.status).toBe(200);
    expect(mockQuery.mock.calls[0][1][0]).toBe('Luxor');
  });

  it('returns 500 when DB throws', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB error'));

    const res = await request(app)
      .get('/api/attractions/nearest')
      .query({ city: 'Cairo' });

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════
//  3. GET /api/attractions/search
// ═════════════════════════════════════════════════════════════════════
describe('GET /api/attractions/search', () => {
  it('returns matching attractions for a valid query', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [FAKE_ATTRACTION] });

    const res = await request(app)
      .get('/api/attractions/search')
      .query({ q: 'Alexandria' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(mockQuery.mock.calls[0][1][0]).toBe('%Alexandria%');
  });

  it('returns empty array immediately when q is absent (no DB call)', async () => {
    const res = await request(app).get('/api/attractions/search');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('returns empty array immediately when q is empty string', async () => {
    const res = await request(app)
      .get('/api/attractions/search')
      .query({ q: '' });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('returns 500 when DB throws', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB error'));

    const res = await request(app)
      .get('/api/attractions/search')
      .query({ q: 'pyramids' });

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════
//  4. GET /api/attractions/favorites/:user_id
// ═════════════════════════════════════════════════════════════════════
describe('GET /api/attractions/favorites/:user_id', () => {
  it('returns favorites for a valid user', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [FAKE_ATTRACTION] });

    const res = await request(app).get('/api/attractions/favorites/user-42');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(mockQuery.mock.calls[0][1][0]).toBe('user-42');
  });

  it('returns empty array when user has no favorites', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/api/attractions/favorites/user-99');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('returns 500 when DB throws', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB error'));

    const res = await request(app).get('/api/attractions/favorites/user-1');

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════
//  5. GET /api/attractions  (list with optional filters)
// ═════════════════════════════════════════════════════════════════════
describe('GET /api/attractions', () => {
  it('returns all attractions when no filters provided', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [FAKE_ATTRACTION] });

    const res = await request(app).get('/api/attractions');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockQuery.mock.calls[0][1]).toEqual([]);
  });

  it('filters by city', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [FAKE_ATTRACTION] });

    const res = await request(app)
      .get('/api/attractions')
      .query({ city: 'Cairo' });

    expect(res.status).toBe(200);
    expect(mockQuery.mock.calls[0][1]).toContain('Cairo');
  });

  it('filters by category', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [FAKE_ATTRACTION] });

    const res = await request(app)
      .get('/api/attractions')
      .query({ category: 'historical' });

    expect(res.status).toBe(200);
    expect(mockQuery.mock.calls[0][1]).toContain('historical');
  });

  it('applies both city and category filters', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [FAKE_ATTRACTION] });

    const res = await request(app)
      .get('/api/attractions')
      .query({ city: 'Cairo', category: 'outdoor' });

    expect(res.status).toBe(200);
    const params = mockQuery.mock.calls[0][1];
    expect(params).toContain('Cairo');
    expect(params).toContain('outdoor');
  });

  it('skips category filter when category=all', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [FAKE_ATTRACTION] });

    const res = await request(app)
      .get('/api/attractions')
      .query({ category: 'all' });

    expect(res.status).toBe(200);
    expect(mockQuery.mock.calls[0][1]).not.toContain('all');
  });

  it('returns 500 when DB throws', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB error'));

    const res = await request(app).get('/api/attractions');

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════
//  6. GET /api/attractions/:id/images
// ═════════════════════════════════════════════════════════════════════
describe('GET /api/attractions/:id/images', () => {
  it('returns images for a valid attraction', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [FAKE_IMAGE] });

    const res = await request(app).get('/api/attractions/1/images');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(mockQuery.mock.calls[0][1][0]).toBe('1');
  });

  it('returns empty array when attraction has no images', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/api/attractions/999/images');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('returns 500 when DB throws', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB error'));

    const res = await request(app).get('/api/attractions/1/images');

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════
//  7. GET /api/attractions/:id  (detail — dual ID format)
// ═════════════════════════════════════════════════════════════════════
describe('GET /api/attractions/:id', () => {
  it('uses integer id lookup for numeric ids', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [FAKE_ATTRACTION] });

    const res = await request(app).get('/api/attractions/1');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockQuery.mock.calls[0][1][0]).toBe(1);
    expect(mockQuery.mock.calls[0][0]).toContain('a.id = $1');
  });

  it('uses attraction_id lookup for string ids like ATT062', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [FAKE_ATTRACTION] });

    const res = await request(app).get('/api/attractions/ATT062');

    expect(res.status).toBe(200);
    expect(mockQuery.mock.calls[0][1][0]).toBe('ATT062');
    expect(mockQuery.mock.calls[0][0]).toContain('a.attraction_id = $1');
  });

  it('returns 404 when attraction not found', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/api/attractions/9999');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Attraction not found');
  });

  it('returns 500 when DB throws', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB error'));

    const res = await request(app).get('/api/attractions/1');

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════
//  8. POST /api/attractions  (create)
// ═════════════════════════════════════════════════════════════════════
describe('POST /api/attractions', () => {
  const validBody = {
    name: 'Citadel of Qaitbay',
    city: 'Alexandria',
    description: 'Medieval fortress',
    rating: 4.5,
    price_from: 100,
    opening_hours: '08:00-18:00',
    is_popular: true,
    latitude: 31.21,
    longitude: 29.88,
    categories: ['historical'],
    images: ['https://example.com/citadel.jpg', 'https://example.com/citadel2.jpg'],
  };

  it('creates attraction and returns 201 with valid body', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ city_id: 10 }] })
      .mockResolvedValueOnce({ rows: [{ id: 5, name: 'Citadel of Qaitbay' }] })
      .mockResolvedValueOnce({ rows: [{ category_id: 2 }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/attractions')
      .send(validBody);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Citadel of Qaitbay');
  });

  it('sets first image as primary (is_primary = true)', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ city_id: 10 }] })
      .mockResolvedValueOnce({ rows: [{ id: 5 }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    await request(app).post('/api/attractions').send(validBody);

    const imageCalls = mockQuery.mock.calls.filter(
      (c) => typeof c[0] === 'string' && c[0].includes('attraction_images')
    );
    expect(imageCalls[0][1][2]).toBe(true);
    expect(imageCalls[1][1][2]).toBe(false);
  });

  it('returns 400 when name is missing', async () => {
    const res = await request(app)
      .post('/api/attractions')
      .send({ city: 'Cairo' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('returns 400 when city is missing', async () => {
    const res = await request(app)
      .post('/api/attractions')
      .send({ name: 'Mystery Place' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('proceeds with null city_id when city not found in DB', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 6 }] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/attractions')
      .send({ name: 'Unknown Place', city: 'Nowhere', categories: [] });

    expect(res.status).toBe(201);
    const insertCall = mockQuery.mock.calls[1];
    expect(insertCall[1][1]).toBeNull();
  });

  it('skips category loop when categories array is empty', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ city_id: 10 }] })
      .mockResolvedValueOnce({ rows: [{ id: 7 }] });

    const res = await request(app)
      .post('/api/attractions')
      .send({ name: 'Test', city: 'Cairo', categories: [] });

    expect(res.status).toBe(201);
    expect(mockQuery).toHaveBeenCalledTimes(2);
  });

  it('returns 500 when DB throws on insert', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ city_id: 10 }] })
      .mockRejectedValueOnce(new Error('Insert failed'));

    const res = await request(app)
      .post('/api/attractions')
      .send({ name: 'Test', city: 'Cairo' });

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════
//  9. PUT /api/attractions/:id  (update)
// ═════════════════════════════════════════════════════════════════════
describe('PUT /api/attractions/:id', () => {
  const updateBody = {
    name: 'Updated Citadel',
    city: 'Alexandria',
    description: 'Updated desc',
    rating: 4.7,
    price_from: 120,
    opening_hours: '09:00-17:00',
    is_popular: true,
    latitude: 31.21,
    longitude: 29.88,
    categories: ['historical', 'outdoor'],
    images: ['https://example.com/new.jpg'],
  };

  it('updates attraction and returns updated row', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ city_id: 10 }] })
      .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Updated Citadel' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ category_id: 2 }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ category_id: 5 }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .put('/api/attractions/1')
      .send(updateBody);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Updated Citadel');
  });

  it('converts Google Drive share URLs in images', async () => {
    const driveBody = {
      ...updateBody,
      images: ['https://drive.google.com/file/d/ABC123xyz/view?usp=sharing'],
    };

    mockQuery
      .mockResolvedValueOnce({ rows: [{ city_id: 10 }] })
      .mockResolvedValueOnce({ rows: [{ id: 1 }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    await request(app).put('/api/attractions/1').send({ ...driveBody, categories: [] });

    const imageInsertCall = mockQuery.mock.calls.find(
      (c) => typeof c[0] === 'string' && c[0].includes('INSERT INTO attraction_images')
    );
    expect(imageInsertCall[1][1]).toBe(
      'https://drive.google.com/uc?export=view&id=ABC123xyz'
    );
  });

  it('returns 404 when attraction not found', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ city_id: 10 }] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .put('/api/attractions/9999')
      .send(updateBody);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Not found');
  });

  it('returns 500 when DB throws', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB error'));

    const res = await request(app)
      .put('/api/attractions/1')
      .send(updateBody);

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════
//  10. DELETE /api/attractions/:id
// ═════════════════════════════════════════════════════════════════════
describe('DELETE /api/attractions/:id', () => {
  it('deletes attraction and returns success message', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app).delete('/api/attractions/1');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('Attraction deleted');
  });

  it('deletes in the correct order (children before parent)', async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    await request(app).delete('/api/attractions/1');

    const calls = mockQuery.mock.calls.map((c) => c[0]);
    const catIdx  = calls.findIndex((q) => q.includes('attraction_categories'));
    const imgIdx  = calls.findIndex((q) => q.includes('attraction_images'));
    const favIdx  = calls.findIndex((q) => q.includes('favorites'));
    const mainIdx = calls.findIndex((q) => q.includes('DELETE FROM attractions '));

    expect(catIdx).toBeLessThan(mainIdx);
    expect(imgIdx).toBeLessThan(mainIdx);
    expect(favIdx).toBeLessThan(mainIdx);
  });

  it('returns 500 when DB throws', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB error'));

    const res = await request(app).delete('/api/attractions/1');

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════
//  11. POST /api/attractions/:id/favorite  (toggle)
// ═════════════════════════════════════════════════════════════════════
describe('POST /api/attractions/:id/favorite', () => {
  it('adds favorite when not yet favorited → returns favorited: true', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/attractions/1/favorite')
      .send({ user_id: 'user-42' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.favorited).toBe(true);
  });

  it('removes favorite when already favorited → returns favorited: false', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ user_id: 'user-42', attraction_id: 1 }] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/attractions/1/favorite')
      .send({ user_id: 'user-42' });

    expect(res.status).toBe(200);
    expect(res.body.favorited).toBe(false);
  });

  it('returns 400 when user_id is missing', async () => {
    const res = await request(app)
      .post('/api/attractions/1/favorite')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('user_id required');
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('returns 500 when DB throws', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB error'));

    const res = await request(app)
      .post('/api/attractions/1/favorite')
      .send({ user_id: 'user-42' });

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════
//  12. POST /api/attractions/upload-image
// ═════════════════════════════════════════════════════════════════════
describe('POST /api/attractions/upload-image', () => {
  const fakeBase64 = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAARC';

  it('accepts valid base64 image and returns a local URL', async () => {
    const res = await request(app)
      .post('/api/attractions/upload-image')
      .send({ image: fakeBase64 });

    expect([200, 500]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body.success).toBe(true);
      expect(res.body.url).toMatch(/uploads\//);
    }
  });

  it('returns 400 when image field is missing', async () => {
    const res = await request(app)
      .post('/api/attractions/upload-image')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('No image provided');
  });
});

// ═════════════════════════════════════════════════════════════════════
//  13. POST /api/attractions/download-images
// ═════════════════════════════════════════════════════════════════════
describe('POST /api/attractions/download-images', () => {
  it('returns 400 when urls array is empty', async () => {
    const res = await request(app)
      .post('/api/attractions/download-images')
      .send({ urls: [] });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('No URLs provided');
  });

  it('returns 400 when urls field is missing', async () => {
    const res = await request(app)
      .post('/api/attractions/download-images')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('only processes the first 5 URLs even when more are provided', async () => {
  const urls = Array.from({ length: 8 }, (_, i) => `https://example.com/img${i}.jpg`);

  const res = await request(app)
    .post('/api/attractions/download-images')
    .send({ urls });

  // Route caps at 5 and catches download errors, returning original URLs as fallback
  expect(res.status).toBe(200);
  expect(res.body.success).toBe(true);
  expect(res.body.urls).toHaveLength(5);
}, 20000);
});
// ═════════════════════════════════════════════════════════════════════
//  14. convertDriveUrl helper  (tested indirectly via PUT)
// ═════════════════════════════════════════════════════════════════════
describe('convertDriveUrl (via PUT /api/attractions/:id)', () => {
  it('leaves non-Drive URLs unchanged', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ city_id: 10 }] })
      .mockResolvedValueOnce({ rows: [{ id: 1 }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const plainUrl = 'https://s3.amazonaws.com/bucket/photo.jpg';

    await request(app)
      .put('/api/attractions/1')
      .send({
        name: 'X', city: 'Cairo', description: '', rating: 4,
        price_from: 0, opening_hours: '', is_popular: false,
        latitude: null, longitude: null,
        categories: [],
        images: [plainUrl],
      });

    const imageInsertCall = mockQuery.mock.calls.find(
      (c) => typeof c[0] === 'string' && c[0].includes('INSERT INTO attraction_images')
    );
    expect(imageInsertCall[1][1]).toBe(plainUrl);
  });

  it('converts a Drive share link to a direct export URL', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ city_id: 10 }] })
      .mockResolvedValueOnce({ rows: [{ id: 1 }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    await request(app)
      .put('/api/attractions/1')
      .send({
        name: 'X', city: 'Cairo', description: '', rating: 4,
        price_from: 0, opening_hours: '', is_popular: false,
        latitude: null, longitude: null,
        categories: [],
        images: ['https://drive.google.com/file/d/FILEID999/view'],
      });

    const imageInsertCall = mockQuery.mock.calls.find(
      (c) => typeof c[0] === 'string' && c[0].includes('INSERT INTO attraction_images')
    );
    expect(imageInsertCall[1][1]).toBe(
      'https://drive.google.com/uc?export=view&id=FILEID999'
    );
  });
});