/**
 * Unit tests for backend/src/routes/recommendations.js
 *
 * Run with:  npm test
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// ── Mock global fetch before importing the router ────────────────────
const mockFetch = jest.fn();
global.fetch = mockFetch;

// ── Imports AFTER the mock ────────────────────────────────────────────
const { default: router } = await import('../src/routes/recommendations.js');
const { default: request } = await import('supertest');
const express = (await import('express')).default;

// ── Build a minimal Express app ───────────────────────────────────────
const app = express();
app.use(express.json());
app.use('/api/recommendations', router);

// ── Helper: build a fake fetch response ──────────────────────────────
const mockResponse = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  text: jest.fn().mockResolvedValue(
    typeof body === 'string' ? body : JSON.stringify(body)
  ),
  json: jest.fn().mockResolvedValue(body),
});

// ── Reset mocks between tests ─────────────────────────────────────────
beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  mockFetch.mockReset();
});

afterEach(() => {
  console.error.mockRestore();
});

// ═════════════════════════════════════════════════════════════════════
//  1. GET /api/recommendations/attractions
// ═════════════════════════════════════════════════════════════════════
describe('GET /api/recommendations/attractions', () => {
  it('returns data from Flask on success', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ attractions: [{ id: 'ATT001' }] }));

    const res = await request(app).get('/api/recommendations/attractions');

    expect(res.status).toBe(200);
    expect(res.body.attractions).toHaveLength(1);
  });

  it('proxies query params to the Flask service URL', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ attractions: [] }));

    await request(app)
      .get('/api/recommendations/attractions')
      .query({ city: 'Cairo', category: 'historical' });

    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).toContain('city=Cairo');
    expect(calledUrl).toContain('category=historical');
  });

  it('hits the correct Flask endpoint', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ attractions: [] }));

    await request(app).get('/api/recommendations/attractions');

    expect(mockFetch.mock.calls[0][0]).toContain('/attractions');
  });

  it('forwards error status and error field from Flask', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ error: 'Not found' }, 404));

    const res = await request(app).get('/api/recommendations/attractions');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('Not found');
  });

  it('uses fallback error message when Flask error field is missing', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({}, 500));

    const res = await request(app).get('/api/recommendations/attractions');

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('Error');
  });

  it('handles invalid JSON from Flask gracefully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: jest.fn().mockResolvedValue('not valid json{{{{'),
    });

    const res = await request(app).get('/api/recommendations/attractions');

    expect(res.status).toBe(200);
    expect(res.body.error).toBe('Invalid response from recommendation service');
    expect(res.body.raw).toBeDefined();
  });

  it('truncates raw body to 200 chars in invalid JSON error', async () => {
    const longInvalidBody = 'x'.repeat(500);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: jest.fn().mockResolvedValue(longInvalidBody),
    });

    const res = await request(app).get('/api/recommendations/attractions');

    expect(res.body.raw).toHaveLength(200);
  });

  it('handles empty body from Flask and returns empty object', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: jest.fn().mockResolvedValue(''),
    });

    const res = await request(app).get('/api/recommendations/attractions');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({});
  });

  it('returns 503 when fetch throws (service down)', async () => {
    mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const res = await request(app).get('/api/recommendations/attractions');

    expect(res.status).toBe(503);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('Recommendation service not available');
  });

  it('returns 503 when fetch times out', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network timeout'));

    const res = await request(app).get('/api/recommendations/attractions');

    expect(res.status).toBe(503);
    expect(res.body.success).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════
//  2. GET /api/recommendations/health
// ═════════════════════════════════════════════════════════════════════
describe('GET /api/recommendations/health', () => {
  it('returns health data wrapped in success on success', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ status: 'ok', uptime: 123 }));

    const res = await request(app).get('/api/recommendations/health');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.service.status).toBe('ok');
    expect(res.body.service.uptime).toBe(123);
  });

  it('hits the correct Flask health URL', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ status: 'ok' }));

    await request(app).get('/api/recommendations/health');

    expect(mockFetch.mock.calls[0][0]).toContain('/health');
  });

  it('returns 503 when fetch throws (service down)', async () => {
    mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const res = await request(app).get('/api/recommendations/health');

    expect(res.status).toBe(503);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('Recommendation service not available');
  });

  it('returns 503 when fetch times out', async () => {
    mockFetch.mockRejectedValueOnce(new Error('fetch failed'));

    const res = await request(app).get('/api/recommendations/health');

    expect(res.status).toBe(503);
    expect(res.body.success).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════
//  3. POST /api/recommendations/itinerary
// ═════════════════════════════════════════════════════════════════════
describe('POST /api/recommendations/itinerary', () => {
  const validBody = { city: 'Cairo', days: 3, budget: 500 };

  it('returns itinerary data wrapped in success on success', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ itinerary: ['day1', 'day2'] }));

    const res = await request(app)
      .post('/api/recommendations/itinerary')
      .send(validBody);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.itinerary).toEqual(['day1', 'day2']);
  });

  it('forwards request body to Flask as JSON', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ itinerary: [] }));

    await request(app)
      .post('/api/recommendations/itinerary')
      .send(validBody);

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain('/itinerary');
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual(validBody);
  });

  it('sets Content-Type application/json header when calling Flask', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ itinerary: [] }));

    await request(app)
      .post('/api/recommendations/itinerary')
      .send(validBody);

    expect(mockFetch.mock.calls[0][1].headers['Content-Type']).toBe('application/json');
  });

  it('forwards error status and error+details fields from Flask', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ error: 'Invalid input', details: 'city missing' }, 400)
    );

    const res = await request(app)
      .post('/api/recommendations/itinerary')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('Invalid input');
    expect(res.body.details).toBe('city missing');
  });

  it('uses fallback error message when Flask error field is missing', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({}, 500));

    const res = await request(app)
      .post('/api/recommendations/itinerary')
      .send(validBody);

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('Recommendation service error');
  });

  it('handles invalid JSON from Flask gracefully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: jest.fn().mockResolvedValue('bad json{{{{'),
    });

    const res = await request(app)
      .post('/api/recommendations/itinerary')
      .send(validBody);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.error).toBe('Invalid response from recommendation service');
  });

  it('truncates raw body to 300 chars in invalid JSON error', async () => {
    const longInvalidBody = 'y'.repeat(600);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: jest.fn().mockResolvedValue(longInvalidBody),
    });

    const res = await request(app)
      .post('/api/recommendations/itinerary')
      .send(validBody);

    expect(res.body.data.raw).toHaveLength(300);
  });

  it('handles empty body from Flask and returns empty data object', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: jest.fn().mockResolvedValue(''),
    });

    const res = await request(app)
      .post('/api/recommendations/itinerary')
      .send(validBody);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual({});
  });

  it('returns 503 when fetch throws (service down)', async () => {
    mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const res = await request(app)
      .post('/api/recommendations/itinerary')
      .send(validBody);

    expect(res.status).toBe(503);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('Recommendation service not available');
  });

  it('works correctly with an empty request body', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ itinerary: [] }));

    const res = await request(app)
      .post('/api/recommendations/itinerary')
      .send({});

    expect(mockFetch.mock.calls[0][1].body).toBe('{}');
  });
});

// ═════════════════════════════════════════════════════════════════════
//  4. POST /api/recommendations/budget-split
// ═════════════════════════════════════════════════════════════════════
describe('POST /api/recommendations/budget-split', () => {
  const validBody = { budget: 1000, days: 3 };

  it('returns fractions wrapped in success on success', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ fractions: { food: 0.4, transport: 0.3, hotel: 0.3 } })
    );

    const res = await request(app)
      .post('/api/recommendations/budget-split')
      .send(validBody);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.fractions).toEqual({ food: 0.4, transport: 0.3, hotel: 0.3 });
  });

  it('forwards request body to Flask as JSON', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ fractions: {} }));

    await request(app)
      .post('/api/recommendations/budget-split')
      .send(validBody);

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain('/budget-split');
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual(validBody);
  });

  it('sets Content-Type application/json header when calling Flask', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ fractions: {} }));

    await request(app)
      .post('/api/recommendations/budget-split')
      .send(validBody);

    expect(mockFetch.mock.calls[0][1].headers['Content-Type']).toBe('application/json');
  });

  it('forwards error status from Flask', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ error: 'Bad request' }, 400));

    const res = await request(app)
      .post('/api/recommendations/budget-split')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('Bad request');
  });

  it('uses fallback error message when Flask error field is missing', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({}, 500));

    const res = await request(app)
      .post('/api/recommendations/budget-split')
      .send(validBody);

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('Error');
  });

  it('returns 503 when fetch throws (service down)', async () => {
    mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const res = await request(app)
      .post('/api/recommendations/budget-split')
      .send(validBody);

    expect(res.status).toBe(503);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('Recommendation service not available');
  });

  it('returns 503 when fetch times out', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network timeout'));

    const res = await request(app)
      .post('/api/recommendations/budget-split')
      .send(validBody);

    expect(res.status).toBe(503);
    expect(res.body.success).toBe(false);
  });

  it('works correctly with an empty request body', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ fractions: {} }));

    const res = await request(app)
      .post('/api/recommendations/budget-split')
      .send({});

    expect(mockFetch.mock.calls[0][1].body).toBe('{}');
  });
});