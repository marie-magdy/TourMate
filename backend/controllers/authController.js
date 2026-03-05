import jwt from 'jsonwebtoken';
import {
  registerUser,
  findUserByEmail,
  comparePasswords,
  updateUserLocation,
} from '../services/authService.js';

/**
 * Authentication Controller
 * Handles HTTP requests for authentication endpoints
 */

/**
 * Register a new user
 * POST /api/auth/register
 * Body: { name, email, password, latitude?, longitude? }
 */
export async function register(req, res) {
  try {
    const { name, email, password, latitude, longitude } = req.body;

    const newUser = await registerUser({
      name,
      email,
      password,
      latitude,
      longitude,
    });

    res.status(201).json({
      message: 'User registered successfully',
      user: newUser,
    });
  } catch (err) {
    console.error('Register error:', err);

    // Handle specific error types
    if (err.statusCode === 400) {
      return res.status(400).json({ error: err.message });
    }

    if (err.statusCode === 409) {
      return res.status(409).json({ error: err.message });
    }

    res.status(500).json({ error: 'Server error. Please try again later.' });
  }
}

/**
 * Login user
 * POST /api/auth/login
 * Body: { email, password }
 */
export async function login(req, res) {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res
        .status(400)
        .json({ error: 'Email and password are required' });
    }

    // Find user by email
    const user = await findUserByEmail(email);

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Compare passwords
    const validPassword = await comparePasswords(password, user.password);

    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { user_id: user.user_id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        user_id: user.user_id,
        name: user.name,
        email: user.email,
        current_city: user.current_city,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error. Please try again later.' });
  }
}

/**
 * Update user's location
 * PUT /api/auth/location
 * Body: { latitude, longitude }
 * Headers: { Authorization: Bearer <token> }
 */
export async function updateLocation(req, res) {
  try {
    const { latitude, longitude } = req.body;
    const user_id = req.user?.user_id; // From JWT middleware

    if (!user_id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!latitude || !longitude) {
      return res
        .status(400)
        .json({ error: 'Latitude and longitude are required' });
    }

    const updatedUser = await updateUserLocation(user_id, latitude, longitude);

    res.json({
      message: 'Location updated successfully',
      user: updatedUser,
    });
  } catch (err) {
    console.error('Update location error:', err);
    res.status(500).json({ error: 'Server error. Please try again later.' });
  }
}

export default {
  register,
  login,
  updateLocation,
};
