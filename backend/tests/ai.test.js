import { jest } from '@jest/globals';

const mockRunPlanCoach = jest.fn();
jest.unstable_mockModule('../src/services/planCoach.js', () => ({
  runPlanCoach: mockRunPlanCoach,
}));

beforeAll(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterAll(() => {
  jest.restoreAllMocks();
});

const { default: request } = await import('supertest');
const { default: express } = await import('express');
const { default: router } = await import('../src/routes/ai.js');

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use('/api/ai', router);

const mockFetch = jest.fn();
beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = mockFetch;
});


// ── POST /plan-coach ────────────────────────────────────────────────
describe('POST /api/ai/plan-coach', () => {
  it('returns 400 when messages is missing or not an array', async () => {
    const r1 = await request(app).post('/api/ai/plan-coach').send({ city: 'Cairo', plan_days: [] });
    expect(r1.status).toBe(400);
    expect(r1.body.error).toMatch(/messages/);

    const r2 = await request(app).post('/api/ai/plan-coach').send({ messages: [], city: 'Cairo', plan_days: [] });
    expect(r2.status).toBe(400);
  });

  it('returns 400 when city or plan_days missing', async () => {
    const res = await request(app)
      .post('/api/ai/plan-coach')
      .send({ messages: [{ role: 'user', content: 'hi' }] });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/city and plan_days/);
  });

  it('calls runPlanCoach and returns its reply + preview on success', async () => {
    mockRunPlanCoach.mockResolvedValueOnce({
      success: true,
      reply: 'Done!',
      plan_days_preview: [{ day: 1 }],
      optimization_warnings: ['warn-1'],
      day_schedules_preview: [{ start_hour: 9 }],
      end_date_preview: '2026-06-03',
      coach_extra_spend_total_preview: 250,
    });

    const res = await request(app)
      .post('/api/ai/plan-coach')
      .send({
        messages: [{ role: 'user', content: 'tweak my plan' }],
        plan_days: [{ day: 1 }],
        city: 'Cairo',
        interests: ['history'],
        budget: 5000,
        is_foreigner: true,
        start_lat: 30.05,
        start_lon: 31.25,
        start_date: '2026-06-01',
        existing_coach_extra_spend_egp: 100,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.reply).toBe('Done!');
    expect(res.body.optimization_warnings).toEqual(['warn-1']);
    expect(res.body.coach_extra_spend_total_preview).toBe(250);

    const callArg = mockRunPlanCoach.mock.calls[0][0];
    expect(callArg.is_foreigner).toBe(true);
    expect(callArg.start_lat).toBe(30.05);
    expect(callArg.budget).toBe(5000);
  });

  it('defaults interests to [] when not an array', async () => {
    mockRunPlanCoach.mockResolvedValueOnce({ success: true, reply: 'ok' });
    await request(app).post('/api/ai/plan-coach').send({
      messages: [{ role: 'user', content: 'x' }],
      plan_days: [],
      city: 'Cairo',
      interests: 'not-an-array',
    });
    expect(mockRunPlanCoach.mock.calls[0][0].interests).toEqual([]);
  });

  it('returns 503 when runPlanCoach returns success=false', async () => {
    mockRunPlanCoach.mockResolvedValueOnce({ success: false, error: 'upstream down' });
    const res = await request(app)
      .post('/api/ai/plan-coach')
      .send({
        messages: [{ role: 'user', content: 'x' }],
        plan_days: [],
        city: 'Cairo',
      });
    expect(res.status).toBe(503);
    expect(res.body.error).toBe('upstream down');
  });

  it('returns 500 when runPlanCoach throws', async () => {
    mockRunPlanCoach.mockRejectedValueOnce(new Error('boom'));
    const res = await request(app)
      .post('/api/ai/plan-coach')
      .send({
        messages: [{ role: 'user', content: 'x' }],
        plan_days: [],
        city: 'Cairo',
      });
    expect(res.status).toBe(500);
  });

  it('defaults optimization_warnings to [] when missing from runPlanCoach result', async () => {
    mockRunPlanCoach.mockResolvedValueOnce({ success: true, reply: 'k' });
    const res = await request(app)
      .post('/api/ai/plan-coach')
      .send({
        messages: [{ role: 'user', content: 'x' }],
        plan_days: [],
        city: 'Cairo',
      });
    expect(res.body.optimization_warnings).toEqual([]);
    expect(res.body.coach_extra_spend_total_preview).toBe(0);
  });
});


// ── POST /chat ──────────────────────────────────────────────────────
describe('POST /api/ai/chat', () => {
  it('returns the assistant message on a successful Groq response', async () => {
    mockFetch.mockResolvedValueOnce({
      json: async () => ({ choices: [{ message: { content: 'Hi from AI' } }] }),
    });
    const res = await request(app)
      .post('/api/ai/chat')
      .send({ messages: [{ role: 'user', content: 'hi' }] });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('Hi from AI');
  });

  it('prepends the system prompt to the messages sent to Groq', async () => {
    mockFetch.mockResolvedValueOnce({
      json: async () => ({ choices: [{ message: { content: 'k' } }] }),
    });
    await request(app)
      .post('/api/ai/chat')
      .send({ messages: [{ role: 'user', content: 'hi' }] });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.messages[0].role).toBe('system');
    expect(body.messages[0].content).toMatch(/Tour Mate/);
    expect(body.messages[1]).toEqual({ role: 'user', content: 'hi' });
  });

  it('returns 500 when Groq has no choices field', async () => {
    mockFetch.mockResolvedValueOnce({ json: async () => ({ error: 'rate limit' }) });
    const res = await request(app)
      .post('/api/ai/chat')
      .send({ messages: [{ role: 'user', content: 'x' }] });
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/No response from AI/);
  });

  it('returns 500 when fetch throws', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network'));
    const res = await request(app)
      .post('/api/ai/chat')
      .send({ messages: [{ role: 'user', content: 'x' }] });
    expect(res.status).toBe(500);
  });
});


// ── POST /speak ─────────────────────────────────────────────────────
describe('POST /api/ai/speak', () => {
  it('returns 400 when text is missing', async () => {
    const res = await request(app).post('/api/ai/speak').send({});
    expect(res.status).toBe(400);
  });

  it('returns 503 when GROQ_API_KEY is not configured', async () => {
    const previous = process.env.GROQ_API_KEY;
    delete process.env.GROQ_API_KEY;
    const res = await request(app).post('/api/ai/speak').send({ text: 'hello' });
    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/GROQ_API_KEY/);
    if (previous != null) process.env.GROQ_API_KEY = previous;
  });

  it('returns base64 audio chunks on a successful TTS call', async () => {
    process.env.GROQ_API_KEY = 'fake-key';
    mockFetch.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer,
    });
    const res = await request(app).post('/api/ai/speak').send({ text: 'hello.' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.audioChunks)).toBe(true);
    expect(res.body.audioChunks.length).toBeGreaterThan(0);
    // 0x01 0x02 0x03 0x04 → "AQIDBA==" in base64
    expect(res.body.audioChunks[0]).toBe('AQIDBA==');
  });

  it('uses voice=daniel when isFemale=false', async () => {
    process.env.GROQ_API_KEY = 'fake-key';
    mockFetch.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => new Uint8Array([0]).buffer,
    });
    await request(app).post('/api/ai/speak').send({ text: 'hi.', isFemale: false });
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.voice).toBe('daniel');
  });

  it('returns 503 when every TTS chunk fails', async () => {
    process.env.GROQ_API_KEY = 'fake-key';
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'upstream down',
    });
    const res = await request(app).post('/api/ai/speak').send({ text: 'hello.' });
    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/TTS failed/);
  });

  it('returns 500 when fetch itself throws', async () => {
    process.env.GROQ_API_KEY = 'fake-key';
    mockFetch.mockRejectedValueOnce(new Error('network'));
    const res = await request(app).post('/api/ai/speak').send({ text: 'hi.' });
    expect(res.status).toBe(500);
  });
});


// ── POST /transcribe ────────────────────────────────────────────────
describe('POST /api/ai/transcribe', () => {
  it('returns 400 when audio is missing', async () => {
    const res = await request(app).post('/api/ai/transcribe').send({});
    expect(res.status).toBe(400);
  });

  it('returns 503 when GROQ_API_KEY is not configured', async () => {
    const previous = process.env.GROQ_API_KEY;
    delete process.env.GROQ_API_KEY;
    const res = await request(app)
      .post('/api/ai/transcribe')
      .send({ audio: Buffer.from('x').toString('base64') });
    expect(res.status).toBe(503);
    if (previous != null) process.env.GROQ_API_KEY = previous;
  });

  it('returns the transcribed text from Whisper on success', async () => {
    process.env.GROQ_API_KEY = 'fake-key';
    mockFetch.mockResolvedValueOnce({
      json: async () => ({ text: '  hello world  ' }),
    });
    const res = await request(app)
      .post('/api/ai/transcribe')
      .send({ audio: Buffer.from('x').toString('base64') });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.text).toBe('hello world');
  });

  it('returns 503 when Whisper response has no text', async () => {
    process.env.GROQ_API_KEY = 'fake-key';
    mockFetch.mockResolvedValueOnce({
      json: async () => ({ error: 'bad audio' }),
    });
    const res = await request(app)
      .post('/api/ai/transcribe')
      .send({ audio: Buffer.from('x').toString('base64') });
    expect(res.status).toBe(503);
  });

  it('returns 500 when fetch throws', async () => {
    process.env.GROQ_API_KEY = 'fake-key';
    mockFetch.mockRejectedValueOnce(new Error('boom'));
    const res = await request(app)
      .post('/api/ai/transcribe')
      .send({ audio: Buffer.from('x').toString('base64') });
    expect(res.status).toBe(500);
  });
});
