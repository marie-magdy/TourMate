// backend/src/routes/admin.js
import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool from '../db.js';

const router = express.Router();

//Admin routes

// GET /api/auth/admin/users
router.get('/admin/users', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.username, u.email, u.role, u.created_at,
        COALESCE(up.points, 0) as points,
        COALESCE(up.total_earned, 0) as total_earned,
        COUNT(DISTINCT f.attraction_id) as favorites_count,
        COALESCE(u.voice_chat_enabled, false) as voice_chat_enabled
       FROM users u
       LEFT JOIN user_points up ON u.id = up.user_id
       LEFT JOIN favorites f ON u.id = f.user_id
       GROUP BY u.id, up.points, up.total_earned
       ORDER BY u.created_at DESC`
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    if (process.env.NODE_ENV !== 'test') console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// DELETE /api/auth/admin/users/:id
router.delete('/admin/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM favorites WHERE user_id = $1', [id]);
    await pool.query('DELETE FROM user_points WHERE user_id = $1', [id]);
    await pool.query('DELETE FROM points_history WHERE user_id = $1', [id]);
    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    res.json({ success: true, message: 'User deleted' });
  } catch (err) {
    if (process.env.NODE_ENV !== 'test') console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PUT /api/auth/admin/users/:id/role
router.put('/admin/users/:id/role', async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    if (!['user', 'admin'].includes(role)) return res.status(400).json({ success: false, message: 'Invalid role' });
    await pool.query('UPDATE users SET role = $1 WHERE id = $2', [role, id]);
    res.json({ success: true, message: `User role updated to ${role}` });
  } catch (err) {
    if (process.env.NODE_ENV !== 'test') console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/auth/admin/users/:id/points
router.post('/admin/users/:id/points', async (req, res) => {
  try {
    const { id } = req.params;
    const { points, reason } = req.body;
      if (!points || typeof points !== 'number') {
        return res.status(400).json({ success: false, message: 'Points must be a number' });
    }
    if (points < 0) {
        return res.status(400).json({ success: false, message: 'Points cannot be negative' });
    }

    await pool.query(
      `INSERT INTO user_points (user_id, points, total_earned)
       VALUES ($1, $2, $2)
       ON CONFLICT (user_id) DO UPDATE
       SET points = user_points.points + $2,
           total_earned = user_points.total_earned + $2`,
      [id, points]
    );
    await pool.query(
      'INSERT INTO points_history (user_id, points, action, description) VALUES ($1, $2, $3, $4)',
      [id, points, 'admin', reason ?? 'Admin bonus points']
    );
    res.json({ success: true, message: 'Points added' });
  } catch (err) {
    if (process.env.NODE_ENV !== 'test') console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/auth/admin/stats
router.get('/admin/stats', async (req, res) => {
  try {
    const safeCount = async (sql, field = 'count') => {
      try {
        const r = await pool.query(sql);
        return parseInt(r.rows?.[0]?.[field] ?? '0', 10) || 0;
      } catch (err) {
        if (process.env.NODE_ENV !== 'test') console.error('[admin/stats] count query failed:', sql, err?.message ?? err);
        return 0;
      }
    };

    const totalUsers = await safeCount('SELECT COUNT(*) FROM users');
    const totalAttractions = await safeCount('SELECT COUNT(*) FROM attractions');
    const totalFavorites = await safeCount('SELECT COUNT(*) FROM favorites');
    const totalPoints = await safeCount('SELECT COALESCE(SUM(total_earned), 0) as total FROM user_points', 'total');

    let topAttractionsRows = [];
    try {
      const topAttractions = await pool.query(
        `SELECT a.name, COALESCE(ci.name, 'Unknown') as city, COUNT(f.id) as favorites
         FROM attractions a
         LEFT JOIN cities ci ON ci.city_id = a.city_id
         LEFT JOIN favorites f ON a.id = f.attraction_id
         GROUP BY a.id, ci.name ORDER BY favorites DESC LIMIT 5`
      );
      topAttractionsRows = topAttractions.rows ?? [];
    } catch (err) {
      if (process.env.NODE_ENV !== 'test') console.error('[admin/stats] top attractions query failed:', err?.message ?? err);
      topAttractionsRows = [];
    }

    res.json({
      success: true,
      data: {
        total_users: totalUsers,
        total_attractions: totalAttractions,
        total_favorites: totalFavorites,
        total_points: totalPoints,
        top_attractions: topAttractionsRows,
      },
    });
  } catch (err) {
    if (process.env.NODE_ENV !== 'test') console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PUT /api/auth/admin/users/:id/voice-access
router.put('/admin/users/:id/voice-access', async (req, res) => {
  try {
    const { id } = req.params;
    const { enabled } = req.body;
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ success: false, message: 'enabled must be boolean' });
    }
    await pool.query(
      'update users set voice_chat_enabled = $1 where id = $2',
      [enabled, id]
    );
    res.json({ success: true, message: `Voice access ${enabled ? 'enabled' : 'disabled'}` });
  } catch (err) {
    if (process.env.NODE_ENV !== 'test') console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;