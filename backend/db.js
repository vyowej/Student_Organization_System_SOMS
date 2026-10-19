/**
 * Database Connection & Schema Link Module (backend/db.js)
 *
 * Connects the Express backend to PostgreSQL and links directly to the
 * canonical SQL schema in ../database/student_org_db.sql.
 */
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

// Primary database folder and SQL schema path (../database/student_org_db.sql),
// with fallback to local backend/schema copies if the main database folder is moved.
const DATABASE_DIR = path.resolve(__dirname, '../database');
const PRIMARY_SCHEMA_PATH = path.resolve(DATABASE_DIR, 'student_org_db.sql');

const SCHEMA_PATH = fs.existsSync(PRIMARY_SCHEMA_PATH)
  ? PRIMARY_SCHEMA_PATH
  : fs.existsSync(path.resolve(__dirname, 'schema/schema_student_db.sql'))
  ? path.resolve(__dirname, 'schema/schema_student_db.sql')
  : path.resolve(__dirname, 'schema/schema.sql');

// Configure PostgreSQL connection pool using environment variables from backend/.env
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  database: process.env.DB_NAME || 'student_org_db',
});

// Log when a client connects or encounters an unexpected idle error
pool.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client:', err);
});

/**
 * Verifies active PostgreSQL connectivity and checks that the linked
 * SQL schema file in ../database/student_org_db.sql is present.
 */
async function testConnection() {
  const schemaExists = fs.existsSync(SCHEMA_PATH);
  try {
    const res = await pool.query('SELECT NOW() as current_time, current_database() as db_name');
    return {
      connected: true,
      database: res.rows[0].db_name,
      timestamp: res.rows[0].current_time,
      databaseDir: DATABASE_DIR,
      schemaPath: SCHEMA_PATH,
      schemaExists,
    };
  } catch (err) {
    return {
      connected: false,
      error: err.message,
      databaseDir: DATABASE_DIR,
      schemaPath: SCHEMA_PATH,
      schemaExists,
    };
  }
}

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
  testConnection,
  DATABASE_DIR,
  SCHEMA_PATH,
};

