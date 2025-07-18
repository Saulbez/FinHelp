import pg from 'pg';
import dotenv from 'dotenv';

// Load environment variables from .env file for local development
dotenv.config();

const { Pool } = pg;

let pool;

// Check if DATABASE_URL environment variable exists (provided by Render)
if (process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false } // Required for Render PostgreSQL
  });
} else {
  // Local development configuration
  pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
  });
}

export default pool;