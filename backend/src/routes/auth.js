import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import pool from '../db.js';

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validation
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address' });
    }

    // Validate password length
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user_id = uuidv4();

    const newUser = await pool.query(
      'INSERT INTO users (user_id, name, email, password) VALUES ($1, $2, $3, $4) RETURNING user_id, name, email',
      [user_id, name, email, hashedPassword]
    );

    res.status(201).json(newUser.rows[0]);

  } catch (err) {
    if (err.code === '23505') { // Unique constraint violation
      return res.status(409).json({ error: 'Email already registered. Please use a different email or login.' });
    }
    console.error('Register error:', err);
    res.status(500).json({ error: 'Server error. Please try again later.' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (user.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email ' });
    }

    // console.log('User found: %o', user.rows[0]);
    // console.log('Comparing password: %s with hash: %s', password, user.rows[0].password);
    // console.log("Hash from DB:", user.rows[0].password);
    // console.log("Hash length:", user.rows[0].password.length);
    console.log("Password from request:", password);
    console.log("Password type:", typeof password);
    const validPassword = await bcrypt.compare(
      password,
      user.rows[0].password
    );

    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { user_id: user.rows[0].user_id, email: user.rows[0].email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ 
      token,
      user: {
        user_id: user.rows[0].user_id,
        name: user.rows[0].name,
        email: user.rows[0].email
      }
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error. Please try again later.' });
  }
});

export default router;