import * as attractionService from '../services/attractionService.js';
import pool from '../src/db.js';

/**
 * Get all attractions with primary image
 */
export async function getAllAttractionsWithImages(req, res) {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit) : null;
    const attractions = await attractionService.getAttractionsWithImages(limit);
    
    res.json({
      success: true,
      data: attractions,
      count: attractions.length
    });
  } catch (error) {
    console.error('Error in getAllAttractionsWithImages:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch attractions'
    });
  }
}

/**
 * Get all attractions with all their images
 */
export async function getAllAttractionsWithAllImages(req, res) {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit) : null;
    const attractions = await attractionService.getAttractionsWithAllImages(limit);
    
    res.json({
      success: true,
      data: attractions,
      count: attractions.length
    });
  } catch (error) {
    console.error('Error in getAllAttractionsWithAllImages:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch attractions with images'
    });
  }
}

/**
 * Get attractions by city with primary image
 */
export async function getAttractionsByCity(req, res) {
  try {
    const { cityId } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit) : null;
    
    const attractions = await attractionService.getAttractionsByCityWithImages(cityId, limit);
    
    res.json({
      success: true,
      data: attractions,
      count: attractions.length,
      cityId: cityId
    });
  } catch (error) {
    console.error('Error in getAttractionsByCity:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch attractions by city'
    });
  }
}

/**
 * Get popular attractions with images
 */
export async function getPopularAttractions(req, res) {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit) : 5;
    const attractions = await attractionService.getPopularAttractionsWithImages(limit);
    
    res.json({
      success: true,
      data: attractions,
      count: attractions.length
    });
  } catch (error) {
    console.error('Error in getPopularAttractions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch popular attractions'
    });
  }
}

/**
 * Get nearest attractions with images
 */
export async function getNearestAttractions(req, res) {
  try {
    const { latitude, longitude } = req.query;
    
    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        error: 'latitude and longitude are required'
      });
    }
    
    const limit = req.query.limit ? parseInt(req.query.limit) : 5;
    const attractions = await attractionService.getNearestAttractionsWithImages(
      parseFloat(latitude),
      parseFloat(longitude),
      limit
    );
    
    res.json({
      success: true,
      data: attractions,
      count: attractions.length
    });
  } catch (error) {
    console.error('Error in getNearestAttractions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch nearest attractions'
    });
  }
}

/**
 * Get single attraction with all images
 */
export async function getAttractionDetails(req, res) {
  try {
    const { attractionId } = req.params;
    
    const query = `
      SELECT
        a.attraction_id,
        a.name,
        a.description,
        a.city_id,
        c.city_name,
        a.latitude,
        a.longitude,
        a.district,
        a.address,
        a.sub_type,
        a.is_outdoor,
        a.avg_visit_hrs,
        a.admission_egp,
        a.avg_rating,
        a.total_reviews,
        a.open_hour,
        a.close_hour,
        a.meal_slot,
        a.price_range,
        a.crowd_label,
        a.crowd_pattern,
        COALESCE(a.image, '') as fallback_image,
        json_agg(
          json_build_object(
            'imageId', ai.id,
            'imageUrl', ai.image_url,
            'filename', ai.filename,
            'createdAt', ai.created_at
          )
        ) FILTER (WHERE ai.id IS NOT NULL) as images
      FROM attractions a
      LEFT JOIN cities c ON a.city_id = c.city_id
      LEFT JOIN attraction_images ai ON a.attraction_id = ai.attraction_id
      WHERE a.attraction_id = $1
      GROUP BY a.attraction_id, c.city_name
    `;
    
    const { rows } = await pool.query(query, [attractionId]);
    
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Attraction not found'
      });
    }
    
    res.json({
      success: true,
      data: rows[0]
    });
  } catch (error) {
    console.error('Error in getAttractionDetails:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch attraction details'
    });
  }
}
