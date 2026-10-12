const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

// LINK TO DATABASE: Path to schema in the database folder
const SCHEMA_PATH = path.resolve(__dirname, '../database/student_org_db.sql');

// DATA RELATED: Connects to PostgreSQL database for storing system information
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  database: process.env.DB_NAME || 'student_org_db',
});

pool.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client:', err);
});

async function testConnection() {
  try {
    const res = await pool.query('SELECT NOW() as current_time, current_database() as db_name');
    return {
      connected: true,
      database: res.rows[0].db_name,
      timestamp: res.rows[0].current_time,
      schemaPath: SCHEMA_PATH,
    };
  } catch (err) {
    return {
      connected: false,
      error: err.message,
      schemaPath: SCHEMA_PATH,
    };
  }
}

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
  testConnection,
  SCHEMA_PATH,
};

