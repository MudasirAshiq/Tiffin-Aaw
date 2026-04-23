import pg from 'pg';
const { Pool } = pg;

// Use the connection string from environment variables
const connectionString = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_8SxCJrEPeFQ3@ep-late-breeze-a4s2ygjz-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require';

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
