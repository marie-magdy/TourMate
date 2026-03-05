import pool from '../src/db.js';
import path from 'path';

/**
 * Image Service
 * Handles image uploads and management for attractions
 */

/**
 * Upload image for attraction
 * @param {string} attraction_id - Attraction ID
 * @param {string} filename - Uploaded filename
 * @param {string} baseUrl - Base URL for images (e.g., http://localhost:3000)
 * @returns {Promise<object>} Image object with URL
 */
export async function uploadAttractionImage(attraction_id, filename, baseUrl) {
  try {
    // Verify attraction exists
    const attractionCheck = await pool.query(
      'SELECT attraction_id FROM attractions WHERE attraction_id = $1',
      [attraction_id]
    );

    if (attractionCheck.rows.length === 0) {
      const error = new Error('Attraction not found');
      error.statusCode = 404;
      throw error;
    }

    // Generate image URL
    const imageUrl = `${baseUrl}/uploads/${filename}`;

    // Save to database
    const result = await pool.query(
      `INSERT INTO attraction_images (attraction_id, image_url, filename)
       VALUES ($1, $2, $3)
       RETURNING id, attraction_id, image_url, created_at`,
      [attraction_id, imageUrl, filename]
    );

    return result.rows[0];
  } catch (err) {
    console.error('Image upload error:', err);
    throw err;
  }
}

/**
 * Get all images for an attraction
 * @param {string} attraction_id - Attraction ID
 * @returns {Promise<array>} Array of image objects
 */
export async function getAttractionImages(attraction_id) {
  try {
    const result = await pool.query(
      `SELECT id, attraction_id, image_url, filename, created_at
       FROM attraction_images
       WHERE attraction_id = $1
       ORDER BY created_at DESC`,
      [attraction_id]
    );

    return result.rows;
  } catch (err) {
    console.error('Error fetching images:', err);
    throw err;
  }
}

/**
 * Get primary image for an attraction
 * @param {string} attraction_id - Attraction ID
 * @returns {Promise<object|null>} First image or null
 */
export async function getPrimaryImage(attraction_id) {
  try {
    const result = await pool.query(
      `SELECT id, attraction_id, image_url, filename, created_at
       FROM attraction_images
       WHERE attraction_id = $1
       ORDER BY created_at ASC
       LIMIT 1`,
      [attraction_id]
    );

    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (err) {
    console.error('Error fetching primary image:', err);
    throw err;
  }
}

/**
 * Delete image
 * @param {number} image_id - Image ID
 * @returns {Promise<boolean>} True if deleted
 */
export async function deleteImage(image_id) {
  try {
    const result = await pool.query(
      'DELETE FROM attraction_images WHERE id = $1 RETURNING filename',
      [image_id]
    );

    if (result.rows.length === 0) {
      const error = new Error('Image not found');
      error.statusCode = 404;
      throw error;
    }

    return result.rows[0];
  } catch (err) {
    console.error('Error deleting image:', err);
    throw err;
  }
}

/**
 * Get images for multiple attractions
 * @param {array} attraction_ids - Array of attraction IDs
 * @returns {Promise<object>} Object mapping attraction_id to images array
 */
export async function getMultipleAttractionsImages(attraction_ids) {
  try {
    if (!attraction_ids || attraction_ids.length === 0) {
      return {};
    }

    const placeholders = attraction_ids.map((_, i) => `$${i + 1}`).join(',');
    const result = await pool.query(
      `SELECT id, attraction_id, image_url, filename, created_at
       FROM attraction_images
       WHERE attraction_id IN (${placeholders})
       ORDER BY attraction_id, created_at ASC`,
      attraction_ids
    );

    // Map results by attraction_id
    const imageMap = {};
    result.rows.forEach((image) => {
      if (!imageMap[image.attraction_id]) {
        imageMap[image.attraction_id] = [];
      }
      imageMap[image.attraction_id].push(image);
    });

    return imageMap;
  } catch (err) {
    console.error('Error fetching multiple attraction images:', err);
    throw err;
  }
}

export default {
  uploadAttractionImage,
  getAttractionImages,
  getPrimaryImage,
  deleteImage,
  getMultipleAttractionsImages,
};
