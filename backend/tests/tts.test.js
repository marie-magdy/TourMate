import { jest } from '@jest/globals';

beforeAll(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterAll(() => {
  jest.restoreAllMocks();
});

const { default: request } = await import('supertest');
const { default: express } = await import('express');
const { default: router } = await import('../src/routes/tts.js');

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use('/api/tts', router);

const mockFetch = jest.fn();
beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = mockFetch;
  process.env.GROQ_API_KEY = 'fake-key';
});


// ── Raw-text mode ───────────────────────────────────────────────────
describe('POST /api/tts — raw_text mode', () => {
  it('returns base64 audio + cleaned script when raw_text is provided', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer,
    });

    const res = await request(app).post('/api/tts').send({
      raw_text: 'Hello world. **markdown** stuff.',
      language: 'en',
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.audio).toBeTruthy();
    // Asterisks should be stripped from the script returned to the client.
    expect(res.body.script).not.toMatch(/\*/);
    expect(res.body.script).toMatch(/Hello world/);
  });

  it('uses English voice (austin) by default', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new Uint8Array([0]).buffer,
    });
    await request(app).post('/api/tts').send({ raw_text: 'hi.' });
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.voice).toBe('austin');
  });

  it('uses Arabic voice (hannah) when language=ar', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new Uint8Array([0]).buffer,
    });
    await request(app).post('/api/tts').send({ raw_text: 'مرحبا.', language: 'ar' });
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.voice).toBe('hannah');
  });

  it('returns 429 when Groq TTS rate-limits the request', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => 'rate limit',
    });
    const res = await request(app).post('/api/tts').send({ raw_text: 'hi.' });
    expect(res.status).toBe(429);
    expect(res.body.rateLimited).toBe(true);
  });

  it('returns 500 when every TTS chunk fails (non-429)', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'down',
    });
    const res = await request(app).post('/api/tts').send({ raw_text: 'hi.' });
    expect(res.status).toBe(500);
    expect(res.body.message).toMatch(/Failed to generate audio/);
  });
});


// ── Attraction mode ─────────────────────────────────────────────────
describe('POST /api/tts — attraction mode', () => {
  it('returns 400 when name is missing and raw_text is not provided', async () => {
    const res = await request(app).post('/api/tts').send({ city: 'Cairo' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/name/i);
  });

  it('calls Groq LLM then Groq TTS and returns script + audio', async () => {
    // 1st fetch → LLM chat completion. 2nd → TTS audio chunk.
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Welcome to the Pyramids! They are ancient.' } }],
        }),
      })
      .mockResolvedValue({
        ok: true,
        arrayBuffer: async () => new Uint8Array([5, 6, 7, 8]).buffer,
      });

    const res = await request(app).post('/api/tts').send({
      name: 'Pyramids',
      city: 'Giza',
      category: 'historical',
      description: 'Ancient wonder',
      price_from: 200,
      open_hour: 8,
      close_hour: 17,
      language: 'en',
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.script).toMatch(/Pyramids/);
    expect(res.body.audio).toBeTruthy();

    // First fetch hits the LLM endpoint.
    const llmUrl = mockFetch.mock.calls[0][0];
    expect(String(llmUrl)).toContain('chat/completions');
    const llmBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(llmBody.model).toMatch(/llama/);
    expect(llmBody.messages[0].content).toMatch(/Pyramids/);
  });

  it('uses the Arabic system prompt when language=ar', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ choices: [{ message: { content: 'مرحبا!' } }] }),
      })
      .mockResolvedValue({
        ok: true,
        arrayBuffer: async () => new Uint8Array([0]).buffer,
      });

    await request(app).post('/api/tts').send({
      name: 'الأهرامات',
      city: 'الجيزة',
      category: 'historical',
      language: 'ar',
    });

    const llmBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(llmBody.messages[0].content).toMatch(/مرشد سياحي/);
  });

  it('returns 500 when the LLM response is missing choices', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ error: 'down' }) });
    const res = await request(app).post('/api/tts').send({
      name: 'X',
      city: 'Y',
      category: 'historical',
      language: 'en',
    });
    expect(res.status).toBe(500);
    expect(res.body.message).toMatch(/Failed to generate tour script/);
  });

  it('returns 429 + the script when TTS rate-limits after the LLM call succeeds', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ choices: [{ message: { content: 'Hello world.' } }] }),
      })
      .mockResolvedValue({
        ok: false,
        status: 429,
        text: async () => 'rate limit',
      });

    const res = await request(app).post('/api/tts').send({
      name: 'X',
      city: 'Y',
      category: 'historical',
      language: 'en',
    });

    expect(res.status).toBe(429);
    expect(res.body.rateLimited).toBe(true);
    expect(res.body.script).toMatch(/Hello world/);
  });

  it('returns 500 when fetch throws unexpectedly', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network'));
    const res = await request(app).post('/api/tts').send({
      name: 'X',
      city: 'Y',
      category: 'historical',
      language: 'en',
    });
    expect(res.status).toBe(500);
  });
});
