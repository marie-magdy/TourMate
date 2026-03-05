import express from 'express';
import {
  register,
  login,
  updateLocation,
} from '../../controllers/authController.js';
import authenticateToken from '../../middleware/auth.js';

const router = express.Router();

/**
 * User Registration
 * POST /api/auth/register
 * Body: { name, email, password, latitude?, longitude? }
 */
router.post('/register', register);

/**
 * User Login
 * POST /api/auth/login
 * Body: { email, password }
 */
router.post('/login', login);

/**
 * Update User Location
 * PUT /api/auth/location
 * Body: { latitude, longitude }
 * Headers: { Authorization: Bearer <token> }
 */
router.put('/location', authenticateToken, updateLocation);

export default router;