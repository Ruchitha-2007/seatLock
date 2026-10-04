import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Detect SSL requirement (e.g. Neon, Supabase, or production DBs)
const isProduction = process.env.NODE_ENV === 'production';
const connectionString = process.env.DATABASE_URL;
const requiresSSL = connectionString?.includes('sslmode=require') || isProduction;

export const pool = new Pool({
  connectionString,
  ssl: requiresSSL ? { rejectUnauthorized: false } : false,
  max: 20, // Max concurrent database connections in pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 20000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client:', err);
});

// Helper for executing queries with automatic connection handling
export const query = async (text, params) => {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  if (process.env.NODE_ENV === 'development' && duration > 100) {
    console.warn(`[SLOW QUERY] ${duration}ms: ${text}`);
  }
  return res;
};

// Test database connection
export const testConnection = async () => {
  try {
    const res = await pool.query('SELECT NOW() AS current_time, version()');
    console.log('✅ Connected to PostgreSQL successfully!');
    console.log(`🕒 Database Server Time: ${res.rows[0].current_time}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to connect to PostgreSQL:', error.message);
    return false;
  }
};
