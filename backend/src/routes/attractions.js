// backend/src/routes/attractions.js
//
// ── IMPORTANT — DATABASE SEPARATION NOTE ─────────────────────────────────────
// This router serves the PostgreSQL attractions table (integer IDs: 1, 2, 3...).
// It is used by: home.tsx (popular/nearest/search/images/favorite),
//                favorites.tsx (favorites list/toggle), attraction.tsx (detail),
//                map.tsx (city pins), and admin screens (CRUD).
//
// The PLAN FLOW (pick-spots → itinerary) does NOT use this router.
// It uses /api/recommendations/* → Flask → TourMate_attractions.xlsx (IDs: "ATT001").
//
// Do NOT add a fallback from the plan flow back to this router.
// The two ID namespaces are incompatible and will silently break favorites.
// ─────────────────────────────────────────────────────────────────────────────
import express from 'express';
import pool from '../db.js';

const router = express.Router();

// ── Helper: base SELECT that joins cities + aggregates categories ─────
// Category resolution order:
//   1. attraction_categories join table  (46 attractions populated)
//   2. a.categories TEXT column fallback (remaining 77 attractions store
//      comma-separated values like 'historical,outdoor,ancient' directly)
const BASE_SELECT = `
  SELECT
    a.*,
    ci.name AS city,
    CASE
      WHEN COUNT(c.name) > 0
        THEN ARRAY_AGG(DISTINCT c.name) FILTER (WHERE c.name IS NOT NULL)
      WHEN a.categories IS NOT NULL AND trim(a.categories) != ''
        THEN string_to_array(
               regexp_replace(trim(a.categories), '\\s*,\\s*', ',', 'g'),
               ','
             )
      ELSE ARRAY[]::text[]
    END AS categories,
    (
      SELECT ai.image_url
      FROM attraction_images ai
      WHERE ai.attraction_id = a.id
        AND ai.is_primary = true
      LIMIT 1
    ) AS primary_image
  FROM attractions a
  LEFT JOIN cities ci ON ci.city_id = a.city_id
  LEFT JOIN attraction_categories ac ON ac.attraction_id = a.id
  LEFT JOIN categories c ON c.category_id = ac.category_id
`;

const GROUP_BY = `GROUP BY a.id, ci.name`;

// ── Helper: convert Google Drive share link to direct URL ─────────────
const convertDriveUrl = (url) => {
  if (!url) return url;
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (match) return `https://drive.google.com/uc?export=view&id=${match[1]}`;
  return url;
};

// ─────────────────────────────────────────────────────────────────────
//  GET /api/attractions/popular
// ─────────────────────────────────────────────────────────────────────
router.get('/popular', async (req, res) => {
  try {
    const result = await pool.query(
      `${BASE_SELECT}
       WHERE a.is_popular = true
       ${GROUP_BY}
       ORDER BY a.rating DESC
       LIMIT 50`
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Popular attractions error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────
//  GET /api/attractions/nearest?lat=..&lon=..&city=Alexandria
// ─────────────────────────────────────────────────────────────────────
router.get('/nearest', async (req, res) => {
  try {
    const { city, lat, lon, limit } = req.query;
    const n = Math.max(1, Math.min(50, parseInt(String(limit ?? '20'), 10) || 20));
    const latNum = lat != null ? Number(lat) : null;
    const lonNum = lon != null ? Number(lon) : null;
    const hasCoords = Number.isFinite(latNum) && Number.isFinite(lonNum);

    if (hasCoords) {
      // Great-circle distance (km). Note: uses DB lat/lon columns; rows missing coords are excluded.
      const params = [latNum, lonNum];
      let where = `WHERE a.latitude IS NOT NULL AND a.longitude IS NOT NULL`;
      if (city) {
        where += ` AND LOWER(ci.name) = LOWER($3)`;
        params.push(city);
      }

      const result = await pool.query(
        `${BASE_SELECT}
         ${where}
         ${GROUP_BY}
         ORDER BY
           (6371 * acos(
             LEAST(
               1,
               GREATEST(
                 -1,
                 cos(radians($1)) * cos(radians(a.latitude)) * cos(radians(a.longitude) - radians($2)) +
                 sin(radians($1)) * sin(radians(a.latitude))
               )
             )
           )) ASC,
           a.rating DESC
         LIMIT ${n}`,
        params,
      );
      return res.json({ success: true, data: result.rows });
    }

    // Fallback: city-based list ordered by rating (legacy behavior)
    const result = await pool.query(
      `${BASE_SELECT}
       WHERE LOWER(ci.name) = LOWER($1)
       ${GROUP_BY}
       ORDER BY a.rating DESC
       LIMIT ${n}`,
      [city ?? 'Alexandria'],
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Nearest attractions error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────
//  GET /api/attractions/search?q=pyramids
// ─────────────────────────────────────────────────────────────────────
router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json({ success: true, data: [] });
    const result = await pool.query(
      `${BASE_SELECT}
       WHERE a.name        ILIKE $1
          OR ci.name       ILIKE $1
          OR a.description ILIKE $1
          OR c.name        ILIKE $1
       ${GROUP_BY}
       ORDER BY a.rating DESC
       LIMIT 10`,
      [`%${q}%`]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────
//  GET /api/attractions/favorites/:user_id
// ─────────────────────────────────────────────────────────────────────
router.get('/favorites/:user_id', async (req, res) => {
  try {
    const { user_id } = req.params;
    const result = await pool.query(
      `${BASE_SELECT}
       INNER JOIN favorites f ON a.id = f.attraction_id
       WHERE f.user_id = $1
       ${GROUP_BY}
       ORDER BY MAX(f.created_at) DESC`,
      [user_id]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Favorites error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────
//  GET /api/attractions/filter
//  Query params:
//    - categories: comma-separated category names (filter to ONLY these)
//    - maxPrice: maximum price threshold
//    - city: city name
//    - page: page number (1-indexed)
//    - per_page: results per page
// ─────────────────────────────────────────────────────────────────────
router.get('/filter', async (req, res) => {
  try {
    const { categories, maxPrice, city, page = 1, per_page = 20 } = req.query;
    
    // Parse query params
    const selectedCategories = categories 
      ? String(categories).split(',').map(c => c.trim()).filter(Boolean)
      : [];
    const maxPriceNum = maxPrice ? Number(maxPrice) : null;
    const pageNum = Math.max(1, Number(page) || 1);
    const perPage = Math.max(1, Math.min(100, Number(per_page) || 20));
    const offset = (pageNum - 1) * perPage;

    // Build WHERE clause
    const params = [];
    let paramIndex = 1;
    let where = 'WHERE 1=1';

    // City filter
    if (city && city.trim()) {
      where += ` AND LOWER(ci.name) = LOWER($${paramIndex++})`;
      params.push(city.trim());
    }

    // Price filter: price_from <= maxPrice
    if (maxPriceNum !== null) {
      where += ` AND a.price_from <= $${paramIndex++}`;
      params.push(maxPriceNum);
    }

    // Category filter: if categories specified, ONLY show attractions with these categories
    // AFTER (checks join table AND text column fallback):
if (selectedCategories.length > 0) {
  const catMappings = {
    history:       ['historical', 'historic', 'ancient', 'palace', 'museum', 'religious', 'landmark'],
    food:          ['restaurant', 'restaurants', 'food', 'cafe', 'bakery', 'coffee', 'dessert', 'ice_cream', 'american', 'burgers', 'casual', 'egyptian', 'fast_food', 'feteer', 'international', 'lebanese', 'mediterranean', 'mixed', 'pizza', 'seafood', 'street_food', 'syrian', 'traditional'],
    party:         ['party', 'nightlife', 'entertainment', 'amusement', 'cinema', 'gaming', 'restaurant', 'restaurants', 'cafe', 'coffee', 'casual', 'local'],
    nightlife:     ['nightlife', 'party', 'entertainment', 'amusement', 'cinema', 'gaming', 'restaurant', 'restaurants', 'cafe', 'coffee', 'casual', 'local'],
    adventure:     ['adventure', 'outdoor', 'sports'],
    diving:        ['diving', 'water sports', 'snorkeling', 'beach', 'water'],
    shopping:      ['shopping', 'markets', 'bazaar', 'mall'],
    nature:        ['nature', 'outdoor', 'parks', 'park', 'coastal', 'nile view'],
    culture:       ['culture', 'cultural', 'arts', 'museum', 'historic', 'palace', 'landmark', 'religious', 'photo_op', 'bridge'],
    family:        ['family', 'kids', 'entertainment', 'amusement', 'cinema', 'gaming', 'park', 'parks', 'outdoor'],
    entertainment: ['entertainment', 'amusement', 'family', 'cinema', 'gaming', 'restaurant', 'cafe', 'coffee'],
  };

  // Expand selected categories to all DB synonyms
  const expandedTerms = [...new Set(
    selectedCategories.flatMap(cat => catMappings[cat.toLowerCase()] ?? [cat.toLowerCase()])
  )];

  const joinConditions = expandedTerms
    .map(() => `LOWER(c2.name) ILIKE $${paramIndex++}`)
    .join(' OR ');
  const textConditions = expandedTerms
    .map(() => `LOWER(a.categories) ILIKE $${paramIndex++}`)
    .join(' OR ');

  where += ` AND (
    EXISTS (
      SELECT 1 FROM attraction_categories ac2
      JOIN categories c2 ON c2.category_id = ac2.category_id
      WHERE ac2.attraction_id = a.id AND (${joinConditions})
    )
    OR (${textConditions})
  )`;

  // Push params twice with % wildcards for substring matching
  // This allows ILIKE to find partial matches
  const wildcardTerms = expandedTerms.map(t => `%${t}%`);
  params.push(...wildcardTerms, ...wildcardTerms);
}

    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(DISTINCT a.id) as total FROM attractions a
       LEFT JOIN cities ci ON ci.city_id = a.city_id
       LEFT JOIN attraction_categories ac ON ac.attraction_id = a.id
       LEFT JOIN categories c ON c.category_id = ac.category_id
       ${where}`,
      params
    );
    const total = Number(countResult.rows[0]?.total ?? 0);

    // Build params for paginated results query (append LIMIT and OFFSET params)
    const resultParams = [...params, perPage, offset];
    const limitIndex = params.length + 1;
    const offsetIndex = params.length + 2;

    // Get paginated results
    const result = await pool.query(
      `${BASE_SELECT}
       ${where}
       ${GROUP_BY}
       ORDER BY a.rating DESC
       LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
      resultParams
    );

    res.json({
      success: true,
      data: result.rows,
      page: pageNum,
      per_page: perPage,
      total: total,
    });
  } catch (err) {
    console.error('Filter attractions error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────
//  GET /api/attractions?city=Cairo&category=historical
// ─────────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { city, category } = req.query;
    const params = [];
    let paramIndex = 1;
    let where = 'WHERE 1=1';

    if (city) {
      where += ` AND LOWER(ci.name) = LOWER($${paramIndex++})`;
      params.push(city);
    }
    if (category && category !== 'all') {
      where += ` AND EXISTS (
        SELECT 1 FROM attraction_categories ac2
        JOIN categories c2 ON c2.category_id = ac2.category_id
        WHERE ac2.attraction_id = a.id AND LOWER(c2.name) = LOWER($${paramIndex++})
      )`;
      params.push(category);
    }

    const result = await pool.query(
      `${BASE_SELECT}
       ${where}
       ${GROUP_BY}
       ORDER BY a.rating DESC`,
      params
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Attractions error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────
//  GET /api/attractions/:id/images
// ─────────────────────────────────────────────────────────────────────
router.get('/:id/images', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT * FROM attraction_images WHERE attraction_id = $1 ORDER BY is_primary DESC',
      [id]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Images error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────
//  GET /api/attractions/:id
// ─────────────────────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    // Itinerary stops use attraction_id (e.g. "ATT062"); home-screen taps use the
    // integer serial id.  Try attraction_id first so both formats work.
    const isInteger = /^\d+$/.test(id);
    const whereClause = isInteger
      ? 'WHERE a.id = $1'
      : 'WHERE a.attraction_id = $1';
    const result = await pool.query(
      `${BASE_SELECT}
       ${whereClause}
       ${GROUP_BY}`,
      [isInteger ? parseInt(id, 10) : id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Attraction not found' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Attraction detail error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────
//  POST /api/attractions
// ─────────────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const {
      name, city, categories, description,
      rating, price_from, opening_hours, is_popular,
      latitude, longitude, images
    } = req.body;

    if (!name || !city) {
      return res.status(400).json({ success: false, message: 'Name and city are required' });
    }

    // Look up city_id
    const cityResult = await pool.query(
      'SELECT city_id FROM cities WHERE LOWER(name) = LOWER($1)',
      [city]
    );
    const city_id = cityResult.rows[0]?.city_id ?? null;

    // const result = await pool.query(
    //   `INSERT INTO attractions
    //     (name, city, city_id, description, image_url, rating, price_from, opening_hours, is_popular, latitude, longitude)
    //    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
    //    RETURNING *`,
    //   [name, city, city_id, description ?? '', image_url ?? '', rating ?? 4.0,
    //    price_from ?? 0, opening_hours ?? '', is_popular ?? false,
    //    latitude ?? null, longitude ?? null]
    // );
    const result = await pool.query(
  `INSERT INTO attractions
    (name, city_id, description, rating, price_from, opening_hours, is_popular, latitude, longitude)
   VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
   RETURNING *`,
  [name, city_id, description ?? '', rating ?? 4.0,
   price_from ?? 0, opening_hours ?? '', is_popular ?? false,
   latitude ?? null, longitude ?? null]
);

    const newAttraction = result.rows[0];

    // Link categories (array of category names)
    if (categories && categories.length > 0) {
      for (const catName of categories) {
        const catResult = await pool.query(
          'SELECT category_id FROM categories WHERE LOWER(name) = LOWER($1)',
          [catName]
        );
        if (catResult.rows[0]) {
          await pool.query(
            'INSERT INTO attraction_categories (attraction_id, category_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [newAttraction.id, catResult.rows[0].category_id]
          );
        }
      }
    }

    // Insert images
    if (images && images.length > 0) {
      for (let i = 0; i < images.length; i++) {
        await pool.query(
          'INSERT INTO attraction_images (attraction_id, image_url, is_primary) VALUES ($1, $2, $3)',
          [newAttraction.id, images[i], i === 0]
        );
      }
    }

    res.status(201).json({ success: true, data: newAttraction });
  } catch (err) {
    console.error('Create attraction error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────
//  PUT /api/attractions/:id
// ─────────────────────────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name, city, categories, description,
      rating, price_from, opening_hours, is_popular,
      latitude, longitude, images
    } = req.body;

    const cityResult = await pool.query(
      'SELECT city_id FROM cities WHERE LOWER(name) = LOWER($1)',
      [city]
    );
    const city_id = cityResult.rows[0]?.city_id ?? null;

    const result = await pool.query(
      `UPDATE attractions SET
        name=$1, city_id=$2, description=$3,
        rating=$4, price_from=$5, opening_hours=$6, is_popular=$7,
        latitude=$8, longitude=$9, updated_at=NOW()
      WHERE id=$10 RETURNING *`,
      [name, city_id, description, rating,
       price_from, opening_hours, is_popular, latitude, longitude, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Not found' });
    }

    if (categories && categories.length > 0) {
      await pool.query('DELETE FROM attraction_categories WHERE attraction_id = $1', [id]);
      for (const catName of categories) {
        const catResult = await pool.query(
          'SELECT category_id FROM categories WHERE LOWER(name) = LOWER($1)',
          [catName]
        );
        if (catResult.rows[0]) {
          await pool.query(
            'INSERT INTO attraction_categories (attraction_id, category_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [id, catResult.rows[0].category_id]
          );
        }
      }
    }

    // ← SIMPLIFIED: only images array, no cleanImageUrl fallback
    if (images && images.length > 0) {
      await pool.query('DELETE FROM attraction_images WHERE attraction_id = $1', [id]);
      for (let i = 0; i < images.length; i++) {
        const cleanUrl = convertDriveUrl(images[i]);
        await pool.query(
          'INSERT INTO attraction_images (attraction_id, image_url, is_primary) VALUES ($1, $2, $3)',
          [id, cleanUrl, i === 0]
        );
      }
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Update attraction error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────
//  DELETE /api/attractions/:id
// ─────────────────────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM attraction_categories WHERE attraction_id = $1', [id]);
    await pool.query('DELETE FROM attraction_images WHERE attraction_id = $1', [id]);
    await pool.query('DELETE FROM favorites WHERE attraction_id = $1', [id]);
    await pool.query('DELETE FROM attractions WHERE id = $1', [id]);
    res.json({ success: true, message: 'Attraction deleted' });
  } catch (err) {
    console.error('Delete attraction error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────
//  POST /api/attractions/:id/favorite
// ─────────────────────────────────────────────────────────────────────
router.post('/:id/favorite', async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id } = req.body;

    if (!user_id) return res.status(400).json({ success: false, message: 'user_id required' });

    const existing = await pool.query(
      'SELECT * FROM favorites WHERE user_id = $1 AND attraction_id = $2',
      [user_id, id]
    );

    if (existing.rows.length > 0) {
      await pool.query(
        'DELETE FROM favorites WHERE user_id = $1 AND attraction_id = $2',
        [user_id, id]
      );
      res.json({ success: true, favorited: false });
    } else {
      await pool.query(
        'INSERT INTO favorites (user_id, attraction_id) VALUES ($1, $2)',
        [user_id, id]
      );
      res.json({ success: true, favorited: true });
    }
  } catch (err) {
    console.error('Favorite error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────
//  POST /api/attractions/upload-image
// ─────────────────────────────────────────────────────────────────────
router.post('/upload-image', async (req, res) => {
  try {
    const { image } = req.body;
    if (!image) return res.status(400).json({ success: false, message: 'No image provided' });

    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    const fs = await import('fs');
    const path = await import('path');
    const uploadsDir = path.default.join(process.cwd(), 'uploads');
    if (!fs.default.existsSync(uploadsDir)) fs.default.mkdirSync(uploadsDir, { recursive: true });

    const filename = `attraction_${Date.now()}.jpg`;
    const filepath = path.default.join(uploadsDir, filename);
    fs.default.writeFileSync(filepath, buffer);

    const url = `http://${process.env.BACKEND_IP || 'localhost'}:3000/uploads/${filename}`;
    res.json({ success: true, url });
  } catch (err) {
    console.error('Upload image error:', err);
    res.status(500).json({ success: false, message: 'Upload failed' });
  }
});

// ─────────────────────────────────────────────────────────────────────
//  POST /api/attractions/download-images
// ─────────────────────────────────────────────────────────────────────
router.post('/download-images', async (req, res) => {
  try {
    const { urls } = req.body;
    if (!urls || urls.length === 0) return res.status(400).json({ success: false, message: 'No URLs provided' });

    const fs    = await import('fs');
    const path  = await import('path');
    const https = await import('https');
    const http  = await import('http');

    const uploadsDir = path.default.join(process.cwd(), 'uploads');
    if (!fs.default.existsSync(uploadsDir)) fs.default.mkdirSync(uploadsDir, { recursive: true });

    const downloadFile = (url) => new Promise((resolve, reject) => {
      const filename = `attraction_${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
      const filepath = path.default.join(uploadsDir, filename);
      const file     = fs.default.createWriteStream(filepath);
      const client   = url.startsWith('https') ? https.default : http.default;

      const request = client.get(url, (response) => {
        if (response.statusCode === 301 || response.statusCode === 302) {
          file.close();
          fs.default.unlinkSync(filepath);
          return downloadFile(response.headers.location).then(resolve).catch(reject);
        }
        if (response.statusCode !== 200) {
          file.close();
          fs.default.unlinkSync(filepath);
          return reject(new Error(`HTTP ${response.statusCode}`));
        }
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve(`http://${process.env.BACKEND_IP || 'localhost'}:3000/uploads/${filename}`);
        });
      });
      request.on('error', (err) => {
        file.close();
        if (fs.default.existsSync(filepath)) fs.default.unlinkSync(filepath);
        reject(err);
      });
      request.setTimeout(15000, () => { request.destroy(); reject(new Error('Timeout')); });
    });

    const savedUrls = [];
    for (const url of urls.slice(0, 5)) {
      try {
        const localUrl = await downloadFile(url);
        savedUrls.push(localUrl);
      } catch (err) {
        console.error('Failed to download image:', url, err.message);
        savedUrls.push(url);
      }
    }

    res.json({ success: true, urls: savedUrls });
  } catch (err) {
    console.error('Download images error:', err);
    res.status(500).json({ success: false, message: 'Download failed' });
  }
});

export default router;