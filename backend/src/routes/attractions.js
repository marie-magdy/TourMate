import express from 'express';
import * as attractionController from '../../controllers/attractionController.js';
import { authenticateToken } from '../../middleware/auth.js';

const router = express.Router();

/**
 * Public endpoints (no auth required)
 */

// Get all attractions with primary image
router.get('/with-images', attractionController.getAllAttractionsWithImages);

// Get all attractions with all their images
router.get('/with-all-images', attractionController.getAllAttractionsWithAllImages);

// Get attractions by city
router.get('/city/:cityId', attractionController.getAttractionsByCity);

// Get popular attractions
router.get('/popular', attractionController.getPopularAttractions);

// Get nearest attractions by coordinates
router.get('/nearest', attractionController.getNearestAttractions);

// Get attraction details with all images
router.get('/:attractionId', attractionController.getAttractionDetails);

export default router;
