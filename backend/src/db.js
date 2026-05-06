import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('supabase')
    ? { rejectUnauthorized: false }
    : false,

  max: 3,                        // ← lower this, session mode can't handle 8
  min: 1,                        // ← don't keep idle connections open
   idleTimeoutMillis: 30_000,      // ← 30s so it doesn't drop too fast
  connectionTimeoutMillis: 10_000, // ← 10s to survive cold start
});

// ← Add this: log when pool is struggling
pool.on('error', (err) => {
  console.error('Unexpected pool error:', err.message);
});

export default pool;