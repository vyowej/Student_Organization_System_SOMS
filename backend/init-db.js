/**
 * Database Initialization & Schema Link Runner (backend/init-db.js)
 *
 * Reads the SQL schema from ../database/student_org_db.sql (resolved via ./db)
 * and applies all ENUM types, tables, constraints, triggers, and indexes
 * to the configured PostgreSQL database.
 */
const fs = require('fs');
const { Pool } = require('pg');
require('dotenv').config();
const { SCHEMA_PATH: DB_SCHEMA_PATH } = require('./db');

/**
 * Connects to PostgreSQL and executes the linked SQL schema file.
 */
async function initializeDatabase() {
  console.log('----------------------------------------------------');
  console.log('Student Organization Management System (SOMS)');
  console.log('Database Initialization & Schema Link Runner');
  console.log('----------------------------------------------------');
  console.log(`[LINK] Resolving schema file at: ${DB_SCHEMA_PATH}`);

  // Ensure the SQL schema file exists before attempting database connection
  if (!fs.existsSync(DB_SCHEMA_PATH)) {
    console.error(`[ERROR] Schema file not found at: ${DB_SCHEMA_PATH}`);
    console.error('Please verify that database/student_org_db.sql exists.');
    process.exit(1);
  }

  // Load the SQL definitions from the linked database folder
  const sqlContent = fs.readFileSync(DB_SCHEMA_PATH, 'utf8');
  console.log(`[FILE] Loaded schema file (${sqlContent.length} bytes)`);

  const dbConfig = {
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    database: process.env.DB_NAME || 'student_org_db',
  };

  console.log(`[CONNECT] Connecting to PostgreSQL at ${dbConfig.host}:${dbConfig.port}/${dbConfig.database} as user '${dbConfig.user}'...`);

  const pool = new Pool(dbConfig);

  let client;
  try {
    client = await pool.connect();
    console.log('[SUCCESS] Database connection established.');

    console.log('[RUN] Executing schema against the database...');
    await client.query(sqlContent);

    console.log('[SUCCESS] All types, tables, functions, triggers, and indexes applied successfully!');
    console.log('----------------------------------------------------');
    console.log('Database is now fully linked and synchronized with backend.');
    console.log('----------------------------------------------------');
  } catch (err) {
    console.error('\n[DATABASE ERROR] Failed to initialize database:');
    console.error(err.message);

    // Provide actionable troubleshooting hints for common PostgreSQL error codes
    if (err.code === '3D000') {
      console.error(`\nHint: The database "${dbConfig.database}" does not exist yet.`);
      console.error(`Create it first by running: CREATE DATABASE ${dbConfig.database}; in psql or pgAdmin.`);
    } else if (err.code === 'ECONNREFUSED') {
      console.error('\nHint: Could not connect to PostgreSQL. Ensure PostgreSQL server is running.');
    } else if (err.code === '28P01') {
      console.error('\nHint: Authentication failed. Verify DB_USER and DB_PASSWORD in backend/.env.');
    } else if (err.code === '42710' || err.code === '42P07') {
      console.error('\nHint: Some types or tables already exist. If you want a fresh start, drop the database or schema first.');
    }
    process.exit(1);
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

// Execute immediately if run directly via `node init-db.js` or `npm run db:init`
if (require.main === module) {
  initializeDatabase();
}

module.exports = {
  DB_SCHEMA_PATH,
  initializeDatabase,
};

