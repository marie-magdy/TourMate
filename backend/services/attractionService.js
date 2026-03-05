import pool from '../src/db.js';

/**
 * Get attractions with primary (first) image
 */
export async function getAttractionsWithImages(limit = null) {
  try {
    let query = `
      SELECT
        a.attraction_id,
        a.name,
        a.description,
        a.city_id,
        c.city_name,
        a.latitude,
        a.longitude,
        a.district,
        a.avg_rating,
        a.total_reviews,
        a.admission_egp,
        ai.image_url,
        ai.filename as image_filename
      FROM attractions a
      LEFT JOIN cities c ON a.city_id = c.city_id
      JOIN LATERAL (
        SELECT image_url, filename
        FROM attraction_images
        WHERE attraction_id = a.attraction_id
        ORDER BY created_at ASC
        LIMIT 1
      ) ai ON TRUE
      ORDER BY a.avg_rating DESC, a.name ASC
    `;

    const params = [];

    if (limit) {
      params.push(limit);
      query += ` LIMIT $1`;
    }

    const result = await pool.query(query, params);
    return result.rows;

  } catch (error) {
    console.error('Error fetching attractions with images:', error);
    throw error;
  }
}
/**
 * Get attractions with all their images
 */
export async function getAttractionsWithAllImages(limit = null) {
  try {
    let query = `
      SELECT
        a.attraction_id,
        a.name,
        a.description,
        a.city_id,
        c.city_name,
        a.latitude,
        a.longitude,
        a.district,
        a.avg_rating,
        a.total_reviews,
        a.admission_egp,
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
      GROUP BY a.attraction_id, c.city_name
      ORDER BY a.avg_rating DESC
    `;
    
    if (limit) {
      query += ` LIMIT ${limit}`;
    }
    
    const result = await pool.query(query);
    return result.rows;
  } catch (error) {
    console.error('Error fetching attractions with all images:', error);
    throw error;
  }
}

/**
 * Get attractions by city with primary image
 */
export async function getAttractionsByCityWithImages(cityId, limit = null) {
  try {
    let query = `
      SELECT
        a.attraction_id,
        a.name,
        a.description,
        a.city_id,
        c.city_name,
        a.latitude,
        a.longitude,
        a.district,
        a.avg_rating,
        a.total_reviews,
        a.admission_egp,
        COALESCE(ai.image_url, a.image) as image_url
      FROM attractions a
      LEFT JOIN cities c ON a.city_id = c.city_id
      LEFT JOIN LATERAL (
        SELECT image_url
        FROM attraction_images
        WHERE attraction_id = a.attraction_id
        ORDER BY created_at ASC
        LIMIT 1
      ) ai ON TRUE
      WHERE a.city_id = $1
      ORDER BY a.avg_rating DESC, a.name ASC
    `;
    
    if (limit) {
      query += ` LIMIT ${limit}`;
    }
    
    const result = await pool.query(query, [cityId]);
    return result.rows;
  } catch (error) {
    console.error('Error fetching attractions by city with images:', error);
    throw error;
  }
}

/**
 * Get popular attractions with images
 */
export async function getPopularAttractionsWithImages(limit = 5) {
  try {
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
        a.avg_rating,
        a.total_reviews,
        a.admission_egp,
        COALESCE(ai.image_url, a.image) as image_url
      FROM attractions a
      LEFT JOIN cities c ON a.city_id = c.city_id
      LEFT JOIN LATERAL (
        SELECT image_url
        FROM attraction_images
        WHERE attraction_id = a.attraction_id
        ORDER BY created_at ASC
        LIMIT 1
      ) ai ON TRUE
      WHERE a.total_reviews > 0
      ORDER BY 
        (a.avg_rating * a.total_reviews) DESC,
        a.avg_rating DESC,
        a.name ASC
      LIMIT $1
    `;
    
    const result = await pool.query(query, [limit]);
    return result.rows;
  } catch (error) {
    console.error('Error fetching popular attractions:', error);
    throw error;
  }
}

/**
 * Get nearest attractions to coordinates with images
 */
export async function getNearestAttractionsWithImages(latitude, longitude, limit = 5) {
  try {
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
        a.avg_rating,
        a.total_reviews,
        a.admission_egp,
        COALESCE(ai.image_url, a.image) as image_url,
        (
          6371 * acos(
            cos(radians($1)) * cos(radians(a.latitude)) *
            cos(radians(a.longitude) - radians($2)) +
            sin(radians($1)) * sin(radians(a.latitude))
          )
        ) AS distance_km
      FROM attractions a
      LEFT JOIN cities c ON a.city_id = c.city_id
      LEFT JOIN LATERAL (
        SELECT image_url
        FROM attraction_images
        WHERE attraction_id = a.attraction_id
        ORDER BY created_at ASC
        LIMIT 1
      ) ai ON TRUE
      WHERE a.latitude IS NOT NULL AND a.longitude IS NOT NULL
      ORDER BY distance_km ASC
      LIMIT $3
    `;
    
    const result = await pool.query(query, [latitude, longitude, limit]);
    return result.rows;
  } catch (error) {
    console.error('Error fetching nearest attractions:', error);
    throw error;
  }
}
