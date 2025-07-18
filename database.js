import pg from 'pg';
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
    database: process.env.DB_NAME, // Your local DB name
    password: process.env.DB_PASSWORD, // Your local password
    port: process.env.DB_PORT,
  });
}

export default pool;