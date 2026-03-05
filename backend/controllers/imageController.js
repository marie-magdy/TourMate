import {
  uploadAttractionImage,
  getAttractionImages,
  deleteImage,
} from '../services/imageService.js';

/**
 * Image Controller
 * Handles HTTP requests for image operations
 */

/**
 * Upload image for attraction
 * POST /api/attractions/:attractionId/images
 */
export async function uploadImage(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const { attractionId } = req.params;
    const baseUrl = `${req.protocol}://${req.get('host')}`;

    const image = await uploadAttractionImage(
      attractionId,
      req.file.filename,
      baseUrl
    );

    res.status(201).json({
      message: 'Image uploaded successfully',
      image,
    });
  } catch (err) {
    console.error('Upload image error:', err);

    if (err.statusCode === 404) {
      return res.status(404).json({ error: err.message });
    }

    res.status(500).json({ error: 'Failed to upload image' });
  }
}

/**
 * Get all images for attraction
 * GET /api/attractions/:attractionId/images
 */
export async function getImages(req, res) {
  try {
    const { attractionId } = req.params;

    const images = await getAttractionImages(attractionId);

    res.json({
      attraction_id: attractionId,
      images,
      total: images.length,
    });
  } catch (err) {
    console.error('Get images error:', err);
    res.status(500).json({ error: 'Failed to fetch images' });
  }
}

/**
 * Delete image
 * DELETE /api/attractions/images/:imageId
 */
export async function deleteImageHandler(req, res) {
  try {
    const { imageId } = req.params;

    const deletedImage = await deleteImage(imageId);

    res.json({
      message: 'Image deleted successfully',
      filename: deletedImage.filename,
    });
  } catch (err) {
    console.error('Delete image error:', err);

    if (err.statusCode === 404) {
      return res.status(404).json({ error: err.message });
    }

    res.status(500).json({ error: 'Failed to delete image' });
  }
}

export default {
  uploadImage,
  getImages,
  deleteImageHandler,
};
