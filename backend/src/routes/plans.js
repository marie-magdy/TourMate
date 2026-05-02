// backend/src/routes/plans.js
import express from 'express';
import pool from '../db.js';

const router = express.Router();

// Ensure the table exists on first use
const ensureTable = pool.query(`
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
`).catch(err => console.error('[plans] table init error:', err));

// POST /api/plans  — save a plan
router.post('/', async (req, res) => {
  await ensureTable;
  try {
    const { user_id, city, start_date, end_date, budget, day_hours, interests, spot_ids, itinerary } = req.body;
    if (!user_id || !itinerary) {
      return res.status(400).json({ success: false, message: 'user_id and itinerary are required' });
    }
    const result = await pool.query(
      `INSERT INTO saved_plans (user_id, city, start_date, end_date, budget, day_hours, interests, spot_ids, itinerary)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, created_at`,
      [user_id, city, start_date, end_date, budget, day_hours,
       JSON.stringify(interests ?? []),
       JSON.stringify(spot_ids ?? []),
       JSON.stringify(itinerary)]
    );
    return res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('[plans] save error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/plans/:user_id  — list saved plans for a user
router.get('/:user_id', async (req, res) => {
  await ensureTable;
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
  await ensureTable;
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
