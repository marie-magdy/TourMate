import express from 'express';
import upload from '../../config/multer.js';
import {
  uploadImage,
  getImages,
  deleteImageHandler,
} from '../../controllers/imageController.js';

const router = express.Router();

/**
 * Upload image for attraction
 * POST /api/images/attractions/:attractionId
 */
router.post('/attractions/:attractionId', upload.single('image'), uploadImage);

/**
 * Get all images for attraction
 * GET /api/images/attractions/:attractionId
 */
router.get('/attractions/:attractionId', getImages);

/**
 * Delete image
 * DELETE /api/images/:imageId
 */
router.delete('/:imageId', deleteImageHandler);

export default router;
