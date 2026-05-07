// backend/src/routes/plans.js
import express from 'express';
import pool from '../db.js';

const router = express.Router();

// Ensure the table exists — runs once on first request, not at import time.
let _tableReady = null;
function ensureTable() {
  if (!_tableReady) {
    _tableReady = pool.query(`
      CREATE TABLE IF NOT EXISTS saved_plans (
        id          SERIAL PRIMARY KEY,
        user_id     INTEGER NOT NULL,
        city        TEXT,
        start_date  TEXT,
        end_date    TEXT,
        budget      TEXT,
        day_hours   TEXT,
        interests   JSONB,
        spot_ids    JSONB,
        itinerary   JSONB,
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `).catch(err => {
      console.error('[plans] table init error:', err);
      _tableReady = null; // allow retry on next request
    });
  }
  return _tableReady;
}

// POST /api/plans  — save a plan
router.post('/', async (req, res) => {
  await ensureTable();
  try {
    const { user_id, city, start_date, end_date, budget, day_hours, interests, spot_ids, itinerary,
      flight_details, hotel_details   // ← add
     } = req.body;
    if (!user_id || !itinerary) {
      return res.status(400).json({ success: false, message: 'user_id and itinerary are required' });
    }
    const result = await pool.query(
  `INSERT INTO saved_plans (
    user_id, city, start_date, end_date, budget,
    day_hours, interests, spot_ids, itinerary,
    flight_details, hotel_details
  )
  VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
  RETURNING id, created_at`,
  [
    user_id, city, start_date, end_date, budget,
    day_hours,
    JSON.stringify(interests ?? []),
    JSON.stringify(spot_ids ?? []),
    JSON.stringify(itinerary),
    flight_details ? JSON.stringify(flight_details) : null,
    hotel_details  ? JSON.stringify(hotel_details)  : null,
  ]
);
    return res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('[plans] save error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/plans/item/:planId — one saved plan (open from "Saved plans" without regenerating)
router.get('/item/:planId', async (req, res) => {
  await ensureTable();
  try {
    const { planId } = req.params;
    const result = await pool.query(
      `SELECT id, user_id, city, start_date, end_date, budget, day_hours, interests, spot_ids, itinerary,
       flight_details, hotel_details, created_at
       FROM saved_plans WHERE id = $1`,
      [planId]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Plan not found' });
    }
    return res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('[plans] get item error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PUT /api/plans/item/:planId — update an existing saved plan (coach edits, date changes, etc.)
router.put('/item/:planId', async (req, res) => {
  await ensureTable();
  try {
    const { planId } = req.params;
    const {
      city, start_date, end_date, budget, day_hours, interests, spot_ids, itinerary,flight_details, hotel_details   // ← add
    } = req.body;
    if (itinerary === undefined) {
      return res.status(400).json({ success: false, message: 'itinerary is required' });
    }
    const result = await pool.query(
  `UPDATE saved_plans SET
    city = $1, start_date = $2, end_date = $3, budget = $4,
    day_hours = $5, interests = $6::jsonb, spot_ids = $7::jsonb,
    itinerary = $8::jsonb,
    flight_details = $9::jsonb,
    hotel_details = $10::jsonb
  WHERE id = $11
  RETURNING id, created_at`,
  [
    city ?? null, start_date ?? null, end_date ?? null, budget ?? null,
    typeof day_hours === 'string' ? day_hours : JSON.stringify(day_hours ?? []),
    JSON.stringify(interests ?? []),
    JSON.stringify(spot_ids ?? []),
    JSON.stringify(itinerary),
    flight_details ? JSON.stringify(flight_details) : null,
    hotel_details  ? JSON.stringify(hotel_details)  : null,
    planId
  ]
);
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Plan not found' });
    }
    return res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('[plans] update error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/plans/:user_id  — list saved plans for a user
router.get('/:user_id', async (req, res) => {
  await ensureTable();
  try {
    const { user_id } = req.params;
    const result = await pool.query(
      'SELECT id, city, start_date, end_date, budget, itinerary, created_at FROM saved_plans WHERE user_id = $1 ORDER BY created_at DESC',
      [user_id]
    );
    return res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('[plans] fetch error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// DELETE /api/plans/:id  — delete a saved plan
router.delete('/:id', async (req, res) => {
  await ensureTable();
  try {
    const { id } = req.params;
    const result = await pool.query(
      'DELETE FROM saved_plans WHERE id = $1 RETURNING id',
      [id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Plan not found' });
    }
    return res.json({ success: true });
  } catch (err) {
    console.error('[plans] delete error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
