import bcrypt from 'bcrypt';
import pool from '../src/db.js';
import { generateNextUserId } from '../models/User.js';
import { getNearestCity } from '../utils/geolocation.js';

/**
 * Authentication Service
 * Handles user registration, login, and password operations
 */

/**
 * Validate user registration input
 * @param {string} name - User's full name
 * @param {string} email - User's email address
 * @param {string} password - User's password
 * @returns {object} { isValid: boolean, error?: string }
 */
export function validateRegistrationInput(name, email, password) {
  if (!name || !email || !password) {
    return {
      isValid: false,
      error: 'Name, email, and password are required',
    };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return {
      isValid: false,
      error: 'Please enter a valid email address',
    };
  }

  if (password.length < 6) {
    return {
      isValid: false,
      error: 'Password must be at least 6 characters',
    };
  }

  return { isValid: true };
}

/**
 * Hash password using bcrypt
 * @param {string} password - Plain text password
 * @returns {Promise<string>} Hashed password
 */
export async function hashPassword(password) {
  try {
    return await bcrypt.hash(password, 10);
  } catch (err) {
    console.error('Error hashing password:', err);
    throw err;
  }
}

/**
 * Compare plain password with hashed password
 * @param {string} plainPassword - Plain text password
 * @param {string} hashedPassword - Hashed password from database
 * @returns {Promise<boolean>} True if passwords match
 */
export async function comparePasswords(plainPassword, hashedPassword) {
  try {
    return await bcrypt.compare(plainPassword, hashedPassword);
  } catch (err) {
    console.error('Error comparing passwords:', err);
    throw err;
  }
}

/**
 * Register a new user
 * @param {object} userData - { name, email, password, latitude?, longitude? }
 * @returns {Promise<object>} Created user object
 */
export async function registerUser(userData) {
  try {
    const { name, email, password, latitude, longitude } = userData;

    // Validate input
    const validation = validateRegistrationInput(name, email, password);
    if (!validation.isValid) {
      const error = new Error(validation.error);
      error.statusCode = 400;
      throw error;
    }

    // Check if email already exists
    const existingUser = await pool.query(
      'SELECT user_id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      const error = new Error(
        'Email already registered. Please use a different email or login.'
      );
      error.statusCode = 409;
      throw error;
    }

    // Generate sequential user ID
    const user_id = await generateNextUserId();

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Determine city based on geolocation
    const city = getNearestCity(latitude, longitude);

    // Insert new user
    const result = await pool.query(
      `INSERT INTO users (user_id, name, email, password, current_city, latitude, longitude)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING user_id, name, email, current_city`,
      [user_id, name, email, hashedPassword, city.city_name, latitude || null, longitude || null]
    );

    return result.rows[0];
  } catch (err) {
    console.error('Registration error:', err);
    throw err;
  }
}

/**
 * Find user by email
 * @param {string} email - User's email
 * @returns {Promise<object|null>} User object or null if not found
 */
export async function findUserByEmail(email) {
  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [
      email,
    ]);
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (err) {
    console.error('Error finding user by email:', err);
    throw err;
  }
}

/**
 * Find user by ID
 * @param {string} user_id - User's ID
 * @returns {Promise<object|null>} User object or null if not found
 */
export async function findUserById(user_id) {
  try {
    const result = await pool.query('SELECT * FROM users WHERE user_id = $1', [
      user_id,
    ]);
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (err) {
    console.error('Error finding user by ID:', err);
    throw err;
  }
}

/**
 * Update user's location
 * @param {string} user_id - User's ID
 * @param {number} latitude - User's latitude
 * @param {number} longitude - User's longitude
 * @returns {Promise<object>} Updated user object
 */
export async function updateUserLocation(user_id, latitude, longitude) {
  try {
    const city = getNearestCity(latitude, longitude);

    const result = await pool.query(
      `UPDATE users 
       SET latitude = $1, longitude = $2, current_city = $3
       WHERE user_id = $4
       RETURNING user_id, name, email, current_city, latitude, longitude`,
      [latitude, longitude, city.city_name, user_id]
    );

    return result.rows[0];
  } catch (err) {
    console.error('Error updating user location:', err);
    throw err;
  }
}

export default {
  validateRegistrationInput,
  hashPassword,
  comparePasswords,
  registerUser,
  findUserByEmail,
  findUserById,
  updateUserLocation,
};
