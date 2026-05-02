// backend/src/routes/ai.js
import express from 'express';

const router = express.Router();

const SYSTEM_PROMPT = `You are Tour Mate, an expert Egyptian travel assistant built into the TourMate app. You are friendly, helpful, and knowledgeable about everything related to Egyptian tourism.

You help users with:
- Detailed information about Egyptian historical places (Pyramids, Sphinx, Luxor Temple, Abu Simbel, Valley of the Kings, Citadel of Qaitbay, Library of Alexandria, Roman Amphitheatre, Karnak Temple, and more)
- Suggesting attractions based on user interests (history, diving, food, adventure, culture, shopping, nightlife, family, nature)
- Budget advice and realistic cost estimates for trips in Egypt (entry fees, food costs, transport)
- Recommending authentic local Egyptian food and restaurants
- Packing tips tailored to each Egyptian city and season
- Help planning detailed daily itineraries for Egyptian cities
- Safety tips and important advice for tourists visiting Egypt
- Best times of year to visit each place in Egypt considering weather and crowds

Always be friendly, warm, and helpful. Use emojis sparingly — maximum 1-2 per response, only when genuinely helpful. Give practical, specific advice with real details like prices, opening hours, and insider tips. Keep responses concise but informative. Focus on Egyptian tourism topics.`;

router.post('/chat', async (req, res) => {
  try {
    const { messages } = req.body;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...messages,
        ],
        max_tokens: 1024,
        temperature: 0.7,
      }),
    });

    const data = await response.json();

    if (data.choices && data.choices[0]) {
      res.json({ success: true, message: data.choices[0].message.content });
    } else {
      console.error('Groq response:', JSON.stringify(data));
      res.status(500).json({ success: false, error: 'No response from AI' });
    }
  } catch (err) {
    console.error('AI error:', err);
    res.status(500).json({ success: false, error: 'AI service error' });
  }
});

router.post('/speak', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ success: false, error: 'No text provided' });

    const cleanText = text
      .replace(/[*_`#~]/g, '')
      .replace(/[\u{1F000}-\u{1FFFF}]|[\u{2600}-\u{27FF}]|[\u{1F300}-\u{1F9FF}]/gu, '')
      .replace(/\n+/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();

    if (!process.env.GROQ_API_KEY) {
      return res.status(503).json({ success: false, error: 'GROQ_API_KEY is not configured' });
    }

    // Groq Orpheus has 200 char limit — split into chunks and fetch all.
    const splitIntoChunks = (text, maxLen = 190) => {
      const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
      const chunks = [];
      let current = '';
      for (const sentence of sentences) {
        const trimmed = sentence.trim();
        if ((current + ' ' + trimmed).trim().length <= maxLen) {
          current = (current + ' ' + trimmed).trim();
        } else {
          if (current) chunks.push(current);
          // If single sentence > maxLen, split by words
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

    const chunks = splitIntoChunks(cleanText);

    const fetchChunk = async (chunk) => {
      const response = await fetch('https://api.groq.com/openai/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'canopylabs/orpheus-v1-english',
          input: chunk,
          voice: 'hannah',
          response_format: 'wav',
        }),
      });
      if (!response.ok) {
        const err = await response.text();
        console.error('Groq TTS chunk error:', err);
        return null;
      }
      const buf = await response.arrayBuffer();
      return Buffer.from(buf).toString('base64');
    };

    // Fetch all chunks in parallel.
    const audioChunks = await Promise.all(chunks.map(fetchChunk));
    const validChunks = audioChunks.filter(Boolean);

    if (validChunks.length === 0) {
      return res.status(503).json({ success: false, error: 'Voice provider unavailable (TTS failed)' });
    }

    res.json({ success: true, audioChunks: validChunks });
  } catch (err) {
    console.error('Speak route error:', err);
    res.status(500).json({ success: false, error: 'TTS service error' });
  }
});

router.post('/transcribe', async (req, res) => {
  try {
    const { audio, mimeType = 'audio/m4a' } = req.body;
    if (!audio) return res.status(400).json({ success: false, error: 'No audio provided' });
    if (!process.env.GROQ_API_KEY) {
      return res.status(503).json({ success: false, error: 'GROQ_API_KEY is not configured' });
    }

    // Convert base64 to buffer
    const audioBuffer = Buffer.from(audio, 'base64');

    // Build multipart form for Groq Whisper
    const formData = new FormData();
    const blob = new Blob([audioBuffer], { type: mimeType });
    formData.append('file', blob, 'recording.m4a');
    formData.append('model', 'whisper-large-v3');
    formData.append('language', 'en');
    formData.append('response_format', 'json');

    const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: formData,
    });

    const data = await response.json();

    if (data.text) {
      res.json({ success: true, text: data.text.trim() });
    } else {
      console.error('Whisper error:', JSON.stringify(data));
      res.status(503).json({ success: false, error: 'Voice provider unavailable (transcription failed)' });
    }
  } catch (err) {
    console.error('Transcribe error:', err);
    res.status(500).json({ success: false, error: 'Transcription service error' });
  }
});

export default router;