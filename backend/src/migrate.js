import pool from './db.js';

async function migrate() {
  try {
    // Check if username column exists
    const result = await pool.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name='users' AND column_name='username'
    `);

    if (result.rows.length === 0) {
      // Add username column if it doesn't exist
      await pool.query(`
        ALTER TABLE users ADD COLUMN username VARCHAR(255) NOT NULL DEFAULT 'user';
      `);
      console.log('✓ Username column added successfully');
    } else {
      console.log('✓ Username column already exists');
    }

    console.log('Migration completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Migration error:', err);
    process.exit(1);
  }
}

migrate();
