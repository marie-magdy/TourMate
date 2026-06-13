// In-process performance benchmark for TourMate.
//
// Runs the actual Express routers with the database layer mocked, times
// N requests per endpoint, computes average + 95th-percentile latency, and
// measures response-body sizes. Also runs a concurrent-user load test.
//
// Run with:  node --experimental-vm-modules tests/benchmark.mjs
//
// All numbers reflect the Express route + JSON-serialisation overhead with
// a mocked pg pool, so they isolate the application layer from disk I/O.

import { performance } from 'node:perf_hooks';
import { jest } from '@jest/globals';

// ── Mock DB layer ────────────────────────────────────────────────────
const mockQuery = jest.fn();
jest.unstable_mockModule('../src/db.js', () => ({
  default: { query: mockQuery },
}));

// Mock bcrypt so /auth/login doesn't actually hash.
jest.unstable_mockModule('bcrypt', () => ({
  default: {
    hash: async () => '$2b$12$mockedhashfortestingonly...',
    compare: async () => true,
  },
}));

// Mock jsonwebtoken so /auth/login returns a token instantly.
jest.unstable_mockModule('jsonwebtoken', () => ({
  default: {
    sign: () => 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.MOCK.MOCK',
  },
}));

// Mock node-fetch (used by recognition) + global fetch (used by recs/ai).
const mockNodeFetch = jest.fn();
jest.unstable_mockModule('node-fetch', () => ({ default: mockNodeFetch }));

const { default: request } = await import('supertest');
const { default: express } = await import('express');

const attractionsRouter   = (await import('../src/routes/attractions.js')).default;
const authRouter          = (await import('../src/routes/auth.js')).default;
const plansRouter         = (await import('../src/routes/plans.js')).default;
const aiRouter            = (await import('../src/routes/ai.js')).default;
const recognitionRouter   = (await import('../src/routes/recognition.js')).default;
const recommendationsRouter = (await import('../src/routes/recommendations.js')).default;

// ── Build a unified app ──────────────────────────────────────────────
const app = express();
app.use(express.json({ limit: '5mb' }));
app.use('/api/attractions',      attractionsRouter);
app.use('/api/auth',             authRouter);
app.use('/api/plans',            plansRouter);
app.use('/api/ai',               aiRouter);
app.use('/api/recognition',      recognitionRouter);
app.use('/api/recommendations',  recommendationsRouter);

// ── Mock data helpers ────────────────────────────────────────────────
const ATTRACTION_ROWS = Array.from({ length: 20 }, (_, i) => ({
  id: i + 1,
  name: `Attraction ${i + 1}`,
  city: 'Cairo',
  description: 'An ancient Egyptian landmark with rich history dating back thousands of years.',
  rating: 4.0 + (i % 10) * 0.1,
  price_from: 50 + i * 10,
  opening_hours: '9-17',
  is_popular: i < 10,
  latitude: 30.04 + i * 0.001,
  longitude: 31.23 + i * 0.001,
  categories: ['historical', 'culture'],
  primary_image: 'https://example.com/img.jpg',
}));

const SINGLE_USER = {
  id: 1,
  username: 'jane',
  email: 'jane@test.com',
  password: '$2b$12$hashedhashedhashedhashedhashedhashedhashedhashedhashed',
  role: 'user',
};

mockQuery.mockImplementation((sql) => {
  const s = String(sql);
  // Default response per pattern.
  if (/SELECT.*FROM users/i.test(s)) return Promise.resolve({ rows: [SINGLE_USER] });
  if (/INSERT INTO users/i.test(s))  return Promise.resolve({ rows: [SINGLE_USER] });
  if (/CREATE TABLE|ALTER TABLE/i.test(s)) return Promise.resolve({ rows: [] });
  if (/SELECT.*FROM saved_plans WHERE id/i.test(s))
    return Promise.resolve({ rowCount: 1, rows: [{ id: 5, city: 'Cairo', itinerary: [] }] });
  if (/INSERT INTO saved_plans/i.test(s))
    return Promise.resolve({ rows: [{ id: 5, created_at: new Date().toISOString() }] });
  if (/SELECT id, city.*FROM saved_plans/i.test(s))
    return Promise.resolve({ rows: [{ id: 5, city: 'Cairo' }] });
  if (/FROM attractions/i.test(s)) return Promise.resolve({ rows: ATTRACTION_ROWS });
  if (/FROM cities/i.test(s))      return Promise.resolve({ rows: [{ city_id: 1 }] });
  return Promise.resolve({ rows: [] });
});

// Mock fetch globally for AI/recommendation routes that call upstream.
global.fetch = async (url) => {
  if (String(url).includes('groq.com')) {
    return {
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Welcome to Egypt — let me help you explore.' } }],
      }),
    };
  }
  if (String(url).includes('5002')) {
    // Recommendation Flask service
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ itinerary: [{ id: 'ATT001' }] }),
    };
  }
  return { ok: true, json: async () => ({}) };
};

mockNodeFetch.mockResolvedValue({
  json: async () => ({ recognized: true, model_label: 'pyramids_giza', confidence: 0.91 }),
});

// ── Benchmark harness ────────────────────────────────────────────────
function percentile(arr, p) {
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * p));
  return sorted[idx];
}

async function timeRequest(builder) {
  const start = performance.now();
  const res = await builder();
  return { ms: performance.now() - start, bytes: Buffer.byteLength(res.text || ''), status: res.status };
}

async function benchEndpoint(label, target, builder, n = 200) {
  // Warmup
  for (let i = 0; i < 20; i++) await builder();
  const samples = [];
  let lastBytes = 0;
  let lastStatus = 0;
  for (let i = 0; i < n; i++) {
    const t = await timeRequest(builder);
    samples.push(t.ms);
    lastBytes = t.bytes;
    lastStatus = t.status;
  }
  const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
  const p95 = percentile(samples, 0.95);
  return { label, target, avg, p95, bytes: lastBytes, status: lastStatus, n };
}

async function loadTest(builder, users) {
  // Fire `users` requests concurrently, measure end-to-end wall time +
  // individual response times. Success = HTTP 2xx.
  const start = performance.now();
  const results = await Promise.all(
    Array.from({ length: users }, async () => {
      const t0 = performance.now();
      const res = await builder();
      return { ms: performance.now() - t0, ok: res.status >= 200 && res.status < 400 };
    })
  );
  const wall = performance.now() - start;
  const successRate = results.filter(r => r.ok).length / results.length;
  const avg = results.reduce((s, r) => s + r.ms, 0) / results.length;
  const p95 = percentile(results.map(r => r.ms), 0.95);
  return { users, wall, avg, p95, successRate };
}

// ── Routes to benchmark ──────────────────────────────────────────────
const ENDPOINTS = [
  ['GET  /attractions',         '< 500 ms', () => request(app).get('/api/attractions?city=Cairo')],
  ['POST /auth/login',          '< 500 ms', () => request(app).post('/api/auth/login').send({ email: 'jane@test.com', password: 'pw1234' })],
  ['POST /plans (itineraries)', '< 1 s',    () => request(app).post('/api/plans').send({ user_id: 1, itinerary: [{ day: 1 }] })],
  ['POST /recognition/analyze', '< 10 s',   () => request(app).post('/api/recognition/analyze').attach('image', Buffer.from('fakejpg'), 'photo.jpg')],
  ['POST /chatbot/message',     '< 2 s',    () => request(app).post('/api/ai/chat').send({ messages: [{ role: 'user', content: 'Tell me about the Pyramids.' }] })],
  ['GET  /map/nearby',          '< 500 ms', () => request(app).get('/api/attractions/nearest?lat=30.05&lon=31.25')],
];

// ── Run ──────────────────────────────────────────────────────────────
const results = { api: [], load: [], payloads: {} };

console.log('Warming up + benchmarking each endpoint (200 iterations each)...');
for (const [label, target, builder] of ENDPOINTS) {
  const r = await benchEndpoint(label, target, builder);
  results.api.push(r);
  console.log(
    `  ${label.padEnd(28)}  avg=${r.avg.toFixed(2).padStart(7)} ms   ` +
    `p95=${r.p95.toFixed(2).padStart(7)} ms   bytes=${r.bytes}   status=${r.status}`,
  );
}

console.log('\nLoad testing /attractions (10/50/100/200/500 concurrent users)...');
const loadBuilder = () => request(app).get('/api/attractions?city=Cairo');
for (const u of [10, 50, 100, 200, 500]) {
  const r = await loadTest(loadBuilder, u);
  results.load.push(r);
  console.log(
    `  ${String(u).padStart(3)} users  wall=${r.wall.toFixed(0)} ms   ` +
    `avg=${r.avg.toFixed(2)} ms   p95=${r.p95.toFixed(2)} ms   success=${(r.successRate * 100).toFixed(1)}%`,
  );
}

// Measure typical response body sizes (for "data consumed" table)
console.log('\nMeasuring response body sizes...');
const PAYLOADS = [
  ['App initial load (token check)',  () => request(app).get('/api/auth/user/1')],
  ['Browse 10 attractions',           () => request(app).get('/api/attractions?city=Cairo')],
  ['Landmark recognition response',   () => request(app).post('/api/recognition/analyze').attach('image', Buffer.from('x'), 'p.jpg')],
  ['Chatbot reply (single turn)',     () => request(app).post('/api/ai/chat').send({ messages: [{ role: 'user', content: 'hi' }] })],
  ['Map (nearby attractions)',        () => request(app).get('/api/attractions/nearest?lat=30&lon=31')],
  ['Generate trip plan',              () => request(app).post('/api/recommendations/itinerary').send({ city: 'Cairo' })],
];
for (const [label, builder] of PAYLOADS) {
  const res = await builder();
  results.payloads[label] = Buffer.byteLength(res.text || '');
  console.log(`  ${label.padEnd(38)} ${results.payloads[label]} bytes`);
}

// ── Persist results for the docx builder ─────────────────────────────
const out = 'C:/Users/Jom/AppData/Local/Temp/benchmark-results.json';
const fs = await import('node:fs');
fs.writeFileSync(out, JSON.stringify(results, null, 2));
console.log('\nWrote', out);

// Dummy test so Jest considers this a valid suite.
test('benchmark ran and produced JSON', () => {
  expect(results.api.length).toBe(6);
  expect(results.load.length).toBe(5);
  expect(Object.keys(results.payloads).length).toBeGreaterThan(0);
});
