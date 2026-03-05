import pool from './db.js';

/**
 * Create attraction_images table for storing multiple images per attraction
 */
async function createAttractionsImagesTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS attraction_images (
        id SERIAL PRIMARY KEY,
        attraction_id VARCHAR(10) NOT NULL,
        image_url VARCHAR(500) NOT NULL,
        filename VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (attraction_id) REFERENCES attractions(attraction_id) ON DELETE CASCADE,
        UNIQUE(attraction_id, filename)
      );
    `);

    // Create indexes for performance
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_attraction_images_attraction_id 
      ON attraction_images(attraction_id);
    `);

    console.log('✓ Attraction images table created successfully');
  } catch (err) {
    console.error('Error creating attraction_images table:', err);
    throw err;
  }
}

/**
 * Run all migrations
 */
async function runMigrations() {
  try {
    console.log('Running migrations...');
    await createAttractionsImagesTable();
    console.log('✓ All migrations completed successfully');
  } catch (err) {
    console.error('Migration error:', err);
    process.exit(1);
  }
}

export default runMigrations;
