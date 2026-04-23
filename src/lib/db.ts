import pg from 'pg';
const { Pool } = pg;

// Use the connection string from environment variables
const connectionString = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_F5x6rGbfRKvZ@ep-round-term-aogwiis6-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';

if (!connectionString) {
  console.warn('DATABASE_URL is not set. Database operations will fail.');
}

export const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false // Required for Neon and many cloud Postgres providers
  }
});

export const query = (text: string, params?: any[]) => pool.query(text, params);
