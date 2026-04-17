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

Always be friendly, warm, and helpful. Use emojis to make responses engaging. Give practical, specific advice with real details like prices, opening hours, and insider tips. Keep responses concise but informative. Focus on Egyptian tourism topics.`;

// POST /api/ai/transcribe
// Body: { audio: base64 }  — raw audio bytes (m4a/wav/webm from Expo Audio.Recording)
// Returns: { success, text }
router.post('/transcribe', async (req, res) => {
  try {
    const { audio } = req.body;
    if (!audio) return res.status(400).json({ success: false, error: 'No audio provided' });

    // Convert base64 → Buffer → Blob for Groq Whisper multipart upload
    const audioBuffer = Buffer.from(audio, 'base64');

    // Node 24 has native FormData and Blob
    const form = new FormData();
    form.append('file', new Blob([audioBuffer], { type: 'audio/m4a' }), 'recording.m4a');
    form.append('model', 'whisper-large-v3');
    form.append('response_format', 'json');

    const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` },
      body: form,
    });

    const data = await response.json();
    if (data.text) {
      res.json({ success: true, text: data.text });
    } else {
      console.error('Whisper error:', JSON.stringify(data));
      res.status(500).json({ success: false, error: 'Transcription failed' });
    }
  } catch (err) {
    console.error('Transcribe error:', err);
    res.status(500).json({ success: false, error: 'Transcription service error' });
  }
});

// POST /api/ai/speak
// Body: { text }
// Returns: { success, audio: base64 }  (ElevenLabs MP3, same format as /tts)
router.post('/speak', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ success: false, error: 'No text provided' });

    const cleanText = text.replace(/[*_`#~]/g, '').replace(/\n{2,}/g, ' ').trim();
    const VOICE_ID = 'JBFqnCBsd6RMkjVDRZzb'; // George — natural English

    const elevenResponse = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': process.env.ELEVENLABS_API_KEY,
        },
        body: JSON.stringify({
          text: cleanText,
          model_id: 'eleven_multilingual_v2',
          voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.3, use_speaker_boost: true },
        }),
      }
    );

    if (!elevenResponse.ok) {
      const errText = await elevenResponse.text();
      console.error('ElevenLabs speak error:', errText);
      return res.status(500).json({ success: false, error: 'TTS failed' });
    }

    const audioBuffer = await elevenResponse.arrayBuffer();
    const base64Audio = Buffer.from(audioBuffer).toString('base64');
    res.json({ success: true, audio: base64Audio });
  } catch (err) {
    console.error('Speak error:', err);
    res.status(500).json({ success: false, error: 'Speak service error' });
  }
});

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

export default router;