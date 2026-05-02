import express from 'express';
import pool from '../db.js';
const router = express.Router();

// ── GET /api/points/rewards/all — MUST be before /:user_id ────────────
router.get('/rewards/all', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM rewards WHERE is_available = true ORDER BY points_required ASC'
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Rewards error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── GET /api/points/:user_id ──────────────────────────────────────────
router.get('/:user_id', async (req, res) => {
  try {
    const { user_id } = req.params;
    const result = await pool.query(
      'SELECT * FROM user_points WHERE user_id = $1',
      [user_id]
    );
    if (result.rows.length === 0) {
      const newEntry = await pool.query(
        'INSERT INTO user_points (user_id, points, total_earned) VALUES ($1, 0, 0) RETURNING *',
        [user_id]
      );
      return res.json({ success: true, data: newEntry.rows[0] });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Points error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── GET /api/points/:user_id/history ─────────────────────────────────
router.get('/:user_id/history', async (req, res) => {
  try {
    const { user_id } = req.params;
    const result = await pool.query(
      'SELECT * FROM points_history WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20',
      [user_id]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('History error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── POST /api/points/earn ─────────────────────────────────────────────
router.post('/earn', async (req, res) => {
  try {
    const { user_id, points, action, description } = req.body;
    if (!user_id || !points || !action) {
      return res.status(400).json({ success: false, message: 'Missing fields' });
    }
    await pool.query(
      `INSERT INTO user_points (user_id, points, total_earned)
       VALUES ($1, $2, $2)
       ON CONFLICT (user_id) DO UPDATE
       SET points = user_points.points + $2,
           total_earned = user_points.total_earned + $2,
           updated_at = CURRENT_TIMESTAMP`,
      [user_id, points]
    );
    await pool.query(
      'INSERT INTO points_history (user_id, points, action, description) VALUES ($1, $2, $3, $4)',
      [user_id, points, action, description]
    );
    const updated = await pool.query(
      'SELECT * FROM user_points WHERE user_id = $1',
      [user_id]
    );
    res.json({ success: true, data: updated.rows[0] });
  } catch (err) {
    console.error('Earn points error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── POST /api/points/redeem ───────────────────────────────────────────
router.post('/redeem', async (req, res) => {
  try {
    const { user_id, reward_id } = req.body;
    const reward = await pool.query('SELECT * FROM rewards WHERE id = $1', [reward_id]);
    if (reward.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Reward not found' });
    }
    const userPoints = await pool.query('SELECT * FROM user_points WHERE user_id = $1', [user_id]);
    if (userPoints.rows.length === 0 || userPoints.rows[0].points < reward.rows[0].points_required) {
      return res.status(400).json({ success: false, message: 'Not enough points' });
    }
    await pool.query(
      'UPDATE user_points SET points = points - $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2',
      [reward.rows[0].points_required, user_id]
    );
    await pool.query(
      'INSERT INTO points_history (user_id, points, action, description) VALUES ($1, $2, $3, $4)',
      [user_id, -reward.rows[0].points_required, 'redeem', `Redeemed: ${reward.rows[0].title}`]
    );
    const updated = await pool.query('SELECT * FROM user_points WHERE user_id = $1', [user_id]);
    res.json({ success: true, data: updated.rows[0], reward: reward.rows[0] });
  } catch (err) {
    console.error('Redeem error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;