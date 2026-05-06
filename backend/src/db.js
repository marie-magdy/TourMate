import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const dbUrl = process.env.DATABASE_URL || '';
const needsSsl =
  /neon\.tech|supabase\.co|railway\.app|render\.com|aiven\.io|azure\.com/i.test(dbUrl) ||
  process.env.DATABASE_SSL === 'true';

const poolMax = Math.min(
  Math.max(1, parseInt(process.env.DATABASE_POOL_MAX || '8', 10)),
  32,
);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: needsSsl ? { rejectUnauthorized: false } : false,
  max: poolMax,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 5_000,
});

export default pool;
