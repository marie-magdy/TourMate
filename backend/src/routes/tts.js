// backend/src/routes/tts.js
import express from 'express';

const router = express.Router();

// ── Groq Orpheus voices (replaces ElevenLabs — free daily quota) ──
// English voices: autumn, diana, hannah, austin, daniel, troy
// Arabic: Groq Orpheus English model doesn't support Arabic,
//         so Arabic falls back to English voice with Arabic script
const VOICES = {
  en: 'austin',   // clear, natural English male — great for audio guides
  ar: 'hannah',   // female voice for Arabic text (reads transliteration)
};

// ── Split long text into chunks ≤ 190 chars (Groq Orpheus limit) ─────
const splitIntoChunks = (text, maxLen = 190) => {
  const sentences = text.match(/[^.!?؟]+[.!?؟]+/g) || [text];
  const chunks = [];
  let current = '';
  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if ((current + ' ' + trimmed).trim().length <= maxLen) {
      current = (current + ' ' + trimmed).trim();
    } else {
      if (current) chunks.push(current);
      if (trimmed.length > maxLen) {
        const words = trimmed.split(' ');
        let part = '';
        for (const word of words) {
          if ((part + ' ' + word).trim().length <= maxLen) {
            part = (part + ' ' + word).trim();
          } else {
            if (part) chunks.push(part);
            part = word;
          }
        }
        if (part) current = part;
      } else {
        current = trimmed;
      }
    }
  }
  if (current) chunks.push(current);
  return chunks;
};

// ── Convert one chunk to base64 audio via Groq Orpheus ───────────────
const fetchChunk = async (chunk, voice) => {
  const response = await fetch('https://api.groq.com/openai/v1/audio/speech', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'canopylabs/orpheus-v1-english',
      input: chunk,
      voice,
      response_format: 'wav',
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    // Rate limit — return special marker
    if (response.status === 429) return 'RATE_LIMITED';
    console.error('Groq TTS chunk error:', response.status, err);
    return null;
  }

  const buf = await response.arrayBuffer();
  return Buffer.from(buf).toString('base64');
};

// ── Combine all chunk base64 WAV buffers into one ────────────────────
// WAV files: keep header from first chunk, append raw PCM from rest
const combineWavChunks = (chunks) => {
  if (chunks.length === 1) return chunks[0];
  const buffers = chunks.map(b => Buffer.from(b, 'base64'));
  // First 44 bytes = WAV header, rest = PCM data
  const header = buffers[0].slice(0, 44);
  const pcmData = buffers.map(b => b.slice(44));
  const combined = Buffer.concat([header, ...pcmData]);
  return combined.toString('base64');
};

// POST /api/tts
// Body: { name, city, category, description, price_from, open_hour, close_hour, language }
//   OR: { raw_text, language }  ← skips Groq script, reads text directly
// Returns: { success, audio: base64, script }
router.post('/', async (req, res) => {
  try {
    const {
      name,
      city,
      category,
      description,
      price_from,
      open_hour,
      close_hour,
      language = 'en',
      raw_text,
    } = req.body;

    const voice = VOICES[language] ?? VOICES.en;

    // ── Raw text mode (AI chatbot bubble listen button) ─────────────
    if (raw_text) {
      const cleanText = raw_text
        .replace(/[*_`#~]/g, '')
        .replace(/[\u{1F000}-\u{1FFFF}]|[\u{2600}-\u{27FF}]|[\u{1F300}-\u{1F9FF}]/gu, '')
        .replace(/\n+/g, ' ')
        .replace(/\s{2,}/g, ' ')
        .trim();

      const chunks = splitIntoChunks(cleanText);
      const results = await Promise.all(chunks.map(c => fetchChunk(c, voice)));

      if (results.includes('RATE_LIMITED')) {
        return res.status(429).json({
          success: false,
          rateLimited: true,
          message: 'Voice is temporarily unavailable. Please try again in a few minutes.',
        });
      }

      const valid = results.filter(Boolean);
      if (valid.length === 0) {
        return res.status(500).json({ success: false, message: 'Failed to generate audio' });
      }

      const combined = combineWavChunks(valid);
      return res.json({ success: true, audio: combined, script: cleanText });
    }

    if (!name) {
      return res.status(400).json({ success: false, message: 'Attraction name is required' });
    }

    // ── Step 1: Generate tour script via Groq LLM ──────────────────
    const isArabic = language === 'ar';

    const hoursEn = open_hour != null && close_hour != null
      ? `${String(open_hour).padStart(2,'0')}:00-${String(close_hour).padStart(2,'0')}:00`
      : 'Not specified';
    const hoursAr = open_hour != null && close_hour != null
      ? `${String(open_hour).padStart(2,'0')}:00-${String(close_hour).padStart(2,'0')}:00`
      : 'غير محدد';

        const prompt = isArabic
      ? `أنت مرشد سياحي محترف في مصر. اكتب تعليقًا صوتيًا قصيرًا وجذابًا باللغة العربية الفصحى عن هذا المكان السياحي لاستخدامه في تطبيق سياحي.

    المكان: ${name}
    المدينة: ${city}
    التصنيف: ${category}
    الوصف: ${description || 'لا يوجد وصف متاح'}
    السعر يبدأ من: ${price_from ? `${price_from} دولار` : 'مجاني'}
    ساعات العمل: ${hoursAr}

    اكتب تعليقًا صوتيًا من 4 إلى 6 جمل فقط. ابدأ بترحيب بالزائر. اجعله حيويًا وشيقًا. لا تستخدم نقاطًا أو عناوين — فقط نص متواصل يُقرأ بصوت عالٍ.`
      : `You are a professional Egyptian tour guide. Write a short, engaging audio guide script in English for this attraction to be used in a tourism app.

    Attraction: ${name}
    City: ${city}
    Category: ${category}
    Description: ${description || 'No description available'}
    Price from: ${price_from ? `$${price_from}` : 'Free'}
    Opening hours: ${hoursEn}

    Write 4 to 6 sentences only. Start by welcoming the visitor to the attraction. Make it vivid and engaging. No bullet points or headers — just flowing text meant to be read aloud.`;

    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 300,
        temperature: 0.7,
      }),
    });

    const groqData = await groqResponse.json();

    if (!groqData.choices || !groqData.choices[0]) {
      console.error('Groq script error:', JSON.stringify(groqData));
      return res.status(500).json({ success: false, message: 'Failed to generate tour script' });
    }

    const script = groqData.choices[0].message.content.trim();

    // ── Step 2: Convert script to audio via Groq Orpheus ──────────
    const cleanScript = script
      .replace(/[*_`#~]/g, '')
      .replace(/[\u{1F000}-\u{1FFFF}]|[\u{2600}-\u{27FF}]|[\u{1F300}-\u{1F9FF}]/gu, '')
      .replace(/\n+/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();

    const chunks = splitIntoChunks(cleanScript);
    console.log(`Audio guide TTS — voice: ${voice} | chunks: ${chunks.length}`);

    const results = await Promise.all(chunks.map(c => fetchChunk(c, voice)));

    if (results.includes('RATE_LIMITED')) {
      // Return script even if audio fails — user can read it
      return res.status(429).json({
        success: false,
        rateLimited: true,
        script,
        message: 'Audio temporarily unavailable. Please try again in a few minutes.',
      });
    }

    const valid = results.filter(Boolean);
    if (valid.length === 0) {
      return res.status(500).json({ success: false, message: 'Failed to generate audio' });
    }

    const combined = combineWavChunks(valid);

    res.json({
      success: true,
      audio: combined,
      script,
    });

  } catch (err) {
    console.error('TTS route error:', err);
    res.status(500).json({ success: false, message: 'TTS service error' });
  }
});

export default router;