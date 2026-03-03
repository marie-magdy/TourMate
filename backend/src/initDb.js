import pool from './db.js';

async function initDb() {
  try {
    // Create users table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('✓ Users table created successfully');

    // Create index on email for faster queries
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    `);

    console.log('✓ Email index created successfully');

    console.log('Database initialized successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Error initializing database:', err);
    process.exit(1);
  }
}

initDb();
