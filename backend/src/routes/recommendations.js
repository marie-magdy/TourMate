import express from 'express';

const router = express.Router();
// const RECOMMENDATION_SERVICE = 'http://localhost:5002';
const RECOMMENDATION_SERVICE = process.env.RECOMMENDER_URL || 'http://recommendation_service:5002';

router.get('/attractions', async (req, res) => {
  try {
    const query    = new URLSearchParams(req.query).toString();
    const response = await fetch(`${RECOMMENDATION_SERVICE}/attractions?${query}`);
    const rawBody  = await response.text();
    let data;
    try {
      data = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      data = { error: 'Invalid response from recommendation service', raw: rawBody.slice(0, 200) };
    }
    if (!response.ok) {
      return res.status(response.status).json({ success: false, error: data.error ?? 'Error' });
    }
    return res.json(data);
  } catch (err) {
    console.error('Excel attractions error:', err);
    return res.status(503).json({ success: false, error: 'Recommendation service not available' });
  }
});

router.get('/health', async (_req, res) => {
  try {
    const response = await fetch(`${RECOMMENDATION_SERVICE}/health`);
    const data = await response.json();
    res.json({ success: true, service: data });
  } catch (err) {
    console.error('Recommendation health error:', err);
    res.status(503).json({ success: false, error: 'Recommendation service not available' });
  }
});

router.post('/itinerary', async (req, res) => {
  try {
    const response = await fetch(`${RECOMMENDATION_SERVICE}/itinerary`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });
    const rawBody = await response.text();
    let data;
    try {
      data = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      data = { error: 'Invalid response from recommendation service', raw: rawBody.slice(0, 300) };
    }

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error: data.error ?? 'Recommendation service error',
        details: data.details,
      });
    }

    return res.json({ success: true, data });
  } catch (err) {
    console.error('Recommendation route error:', err);
    return res.status(503).json({
      success: false,
      error: 'Recommendation service not available',
    });
  }
});

router.post('/budget-split', async (req, res) => {
  try {
    const response = await fetch(`${RECOMMENDATION_SERVICE}/budget-split`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ success: false, error: data.error ?? 'Error' });
    }
    return res.json({ success: true, fractions: data.fractions });
  } catch (err) {
    console.error('Budget-split route error:', err);
    return res.status(503).json({ success: false, error: 'Recommendation service not available' });
  }
});

export default router;
