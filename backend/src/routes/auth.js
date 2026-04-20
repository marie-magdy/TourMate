// backend/src/routes/auth.js
import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool from '../db.js';

const router = express.Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await pool.query(
      'INSERT INTO users (username, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id, username, email, role',
      [username, email, hashedPassword, 'user']
    );
    res.status(201).json(newUser.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'User already exists' });
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/google — Google OAuth login/register
router.post('/google', async (req, res) => {
  try {
    const { google_id, email, username, avatar_url } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email required' });

    // Check if user exists
    let result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

    let user;
    if (result.rows.length === 0) {
      // New user — create account (no password needed for Google users)
      const newUser = await pool.query(
        `INSERT INTO users (username, email, password, role, avatar_url)
         VALUES ($1, $2, $3, 'user', $4)
         RETURNING id, username, email, role`,
        [username, email, 'GOOGLE_AUTH_' + google_id, avatar_url ?? null]
      );
      user = newUser.rows[0];

      // Give welcome points
      await pool.query(
        `INSERT INTO user_points (user_id, points, total_earned) VALUES ($1, 50, 50)
         ON CONFLICT (user_id) DO NOTHING`,
        [user.id]
      );
    } else {
      user = result.rows[0];
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      token,
      user: { id: user.id, email: user.email, username: user.username, role: user.role },
    });
  } catch (err) {
    console.error('Google auth error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }
    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.json({
      token,
      user: { id: user.id, email: user.email, username: user.username, role: user.role },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/auth/user/:id
router.get('/user/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT id, username AS name, email, role FROM users WHERE id = $1',
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PUT /api/auth/user/:id
router.put('/user/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { username, email } = req.body;
    if (!username || !email) return res.status(400).json({ success: false, message: 'Username and email required' });
    const result = await pool.query(
      'UPDATE users SET username = $1, email = $2 WHERE id = $3 RETURNING id, username AS name, email, role',
      [username, email, id]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PUT /api/auth/user/:id/password
router.put('/user/:id/password', async (req, res) => {
  try {
    const { id } = req.params;
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) {
      return res.status(400).json({ success: false, message: 'Both passwords required' });
    }
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'User not found' });
    const valid = await bcrypt.compare(current_password, result.rows[0].password);
    if (!valid) return res.status(400).json({ success: false, message: 'Current password is incorrect' });
    const hashed = await bcrypt.hash(new_password, 10);
    await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashed, id]);
    res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// DELETE /api/auth/user/:id
router.delete('/user/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM favorites WHERE user_id = $1', [id]);
    await pool.query('DELETE FROM user_points WHERE user_id = $1', [id]);
    await pool.query('DELETE FROM points_history WHERE user_id = $1', [id]);
    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    res.json({ success: true, message: 'Account deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── Admin routes ──────────────────────────────────────────────────────

// GET /api/auth/admin/users
router.get('/admin/users', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.username, u.email, u.role, u.created_at,
        COALESCE(up.points, 0) as points,
        COALESCE(up.total_earned, 0) as total_earned,
        COUNT(DISTINCT f.attraction_id) as favorites_count
       FROM users u
       LEFT JOIN user_points up ON u.id = up.user_id
       LEFT JOIN favorites f ON u.id = f.user_id
       GROUP BY u.id, up.points, up.total_earned
       ORDER BY u.created_at DESC`
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error(err);
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
    console.error(err);
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
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/auth/admin/users/:id/points
router.post('/admin/users/:id/points', async (req, res) => {
  try {
    const { id } = req.params;
    const { points, reason } = req.body;
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
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/auth/admin/stats
router.get('/admin/stats', async (req, res) => {
  try {
    const [users, attractions, favorites, points] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM users'),
      pool.query('SELECT COUNT(*) FROM attractions'),
      pool.query('SELECT COUNT(*) FROM favorites'),
      pool.query('SELECT COALESCE(SUM(total_earned), 0) as total FROM user_points'),
    ]);
    const topAttractions = await pool.query(
      `SELECT a.name, a.city, COUNT(f.id) as favorites
       FROM attractions a
       LEFT JOIN favorites f ON a.id = f.attraction_id
       GROUP BY a.id ORDER BY favorites DESC LIMIT 5`
    );
    res.json({
      success: true,
      data: {
        total_users:       parseInt(users.rows[0].count),
        total_attractions: parseInt(attractions.rows[0].count),
        total_favorites:   parseInt(favorites.rows[0].count),
        total_points:      parseInt(points.rows[0].total),
        top_attractions:   topAttractions.rows,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;