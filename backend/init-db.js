/**
 * Database Initialization & Schema Link Runner (backend/init-db.js)
 *
 * Reads the SQL schema from ../database/student_org_db.sql (resolved via ./db)
 * and applies all ENUM types, tables, constraints, triggers, indexes, and seed
 * data (Colleges, Departments, Programs, Organizations) to PostgreSQL.
 */
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { SCHEMA_PATH: DB_SCHEMA_PATH } = require('./db');

/**
 * Ensures the default administrative account exists in PostgreSQL.
 */
async function ensureAdminAccount(client) {
  const userCountRes = await client.query("SELECT COUNT(*)::int AS count FROM users WHERE role = 'ADMIN'");
  if (userCountRes.rows[0].count === 0) {
    const adminHash = await bcrypt.hash('admin123', 10);
    await client.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, role, status)
       VALUES ('admin@wmsu.edu.ph', $1, 'System', 'Administrator', 'ADMIN', 'ACTIVE')
       ON CONFLICT DO NOTHING`,
      [adminHash]
    );
    console.log('[SEED] Created default administrator account: admin@wmsu.edu.ph (Password: admin123)');
  }
}

/**
 * Applies schema migrations if the database already existed prior to new feature additions.
 */


async function ensureAdviserAccounts(client) {
  const adviserHash = await bcrypt.hash('adviser123', 10);
  await client.query(`
    UPDATE users
       SET password_hash = $1, status = 'ACTIVE'
     WHERE role = 'ADVISER'
  `, [adviserHash]);
}

async function applyIncrementalMigrations(client) {
  console.log('[MIGRATE] Ensuring education_level and organization categories types are registered...');
  await client.query(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'education_level') THEN
        CREATE TYPE education_level AS ENUM ('UNDERGRADUATE', 'GRADUATE');
      END IF;
    END $$;
  `);

  for (const newType of ['PUBLICATION', 'TECHNOLOGY', 'LEADERSHIP', 'SPORTS']) {
    await client.query(`
      ALTER TYPE org_type ADD VALUE IF NOT EXISTS '${newType}' BEFORE 'OTHER';
    `).catch(() => {
      // Already committed or present
    });
  }

  console.log('[MIGRATE] Ensuring eligibility columns and adviser titles exist...');
  await client.query(`
    ALTER TABLE advisers
      ADD COLUMN IF NOT EXISTS title VARCHAR(50);

    ALTER TABLE programs
      ADD COLUMN IF NOT EXISTS level education_level NOT NULL DEFAULT 'UNDERGRADUATE';

    ALTER TABLE organizations
      ADD COLUMN IF NOT EXISTS eligible_level education_level DEFAULT 'UNDERGRADUATE',
      ADD COLUMN IF NOT EXISTS min_year_level INTEGER,
      ADD COLUMN IF NOT EXISTS max_year_level INTEGER,
      ADD COLUMN IF NOT EXISTS eligibility_notes TEXT;

    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_org_year_range') THEN
        ALTER TABLE organizations ADD CONSTRAINT chk_org_year_range CHECK (
          (min_year_level IS NULL OR min_year_level BETWEEN 1 AND 6) AND
          (max_year_level IS NULL OR max_year_level BETWEEN 1 AND 6) AND
          (min_year_level IS NULL OR max_year_level IS NULL OR min_year_level <= max_year_level)
        );
      END IF;
    END $$;

    CREATE TABLE IF NOT EXISTS system_settings (
      key         VARCHAR(100) PRIMARY KEY,
      value       JSONB NOT NULL,
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  console.log('[MIGRATE] Updating student_can_join eligibility validation function...');
  await client.query(`
    CREATE OR REPLACE FUNCTION student_can_join(p_org_id INTEGER, p_student_id INTEGER)
    RETURNS BOOLEAN AS $$
    DECLARE
        o         organizations%ROWTYPE;
        s_college INTEGER;
        s_dept    INTEGER;
        s_level   education_level;
        s_year    INTEGER;
    BEGIN
        SELECT * INTO o FROM organizations WHERE id = p_org_id;
        IF NOT FOUND THEN
            RETURN FALSE;
        END IF;

        SELECT d.college_id, d.id, p.level, st.year_level
          INTO s_college, s_dept, s_level, s_year
          FROM students st
          JOIN programs p    ON p.id = st.program_id
          JOIN departments d ON d.id = p.department_id
         WHERE st.id = p_student_id;

        IF NOT FOUND THEN
            RETURN FALSE;
        END IF;

        -- Undergraduate / graduate restriction
        IF o.eligible_level IS NOT NULL AND o.eligible_level <> s_level THEN
            RETURN FALSE;
        END IF;

        -- Year-level restriction
        IF o.min_year_level IS NOT NULL AND s_year < o.min_year_level THEN
            RETURN FALSE;
        END IF;
        IF o.max_year_level IS NOT NULL AND s_year > o.max_year_level THEN
            RETURN FALSE;
        END IF;

        -- College / department restriction
        IF o.scope = 'UNIVERSITY' THEN
            RETURN TRUE;
        END IF;

        IF o.scope = 'COLLEGE' THEN
            RETURN s_college = o.college_id;
        END IF;

        RETURN s_dept = o.department_id;
    END;
    $$ LANGUAGE plpgsql STABLE;
  `);
}

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

    try {
      console.log('[RUN] Executing canonical schema against the database...');
      await client.query(sqlContent);
      console.log('[SUCCESS] All types, tables, functions, triggers, and indexes applied successfully!');
    } catch (err) {
      if (err.code === '42710' || err.code === '42P07') {
        console.log('[INFO] Database tables already exist. Synchronizing schema updates and seed registry...');
        await applyIncrementalMigrations(client);

        // Run seed section from canonical schema file
        const seedMarker = '-- 10. CANONICAL WMSU SEED DATA';
        const seedIndex = sqlContent.indexOf(seedMarker);
        if (seedIndex !== -1) {
          const seedSql = sqlContent.slice(seedIndex);
          await client.query(seedSql);
          console.log('[SUCCESS] Canonical colleges, departments, programs, and organizations synchronized.');
        }
      } else {
        throw err;
      }
    }

    // Ensure default administrative account exists
    await ensureAdminAccount(client);
    await ensureAdviserAccounts(client);

    // Verify system data counts
    const counts = await client.query(`
      SELECT
        (SELECT COUNT(*)::int FROM information_schema.tables WHERE table_schema = 'public') AS tables,
        (SELECT COUNT(*)::int FROM colleges) AS colleges,
        (SELECT COUNT(*)::int FROM departments) AS departments,
        (SELECT COUNT(*)::int FROM programs) AS programs,
        (SELECT COUNT(*)::int FROM organizations) AS organizations,
        (SELECT COUNT(*)::int FROM advisers) AS advisers,
        (SELECT COUNT(*)::int FROM organization_advisers WHERE ended_at IS NULL) AS assigned_advisers
    `);
    const stats = counts.rows[0];
    console.log(`[VERIFY] System state: ${stats.tables} tables, ${stats.colleges} colleges, ${stats.departments} departments, ${stats.programs} programs, ${stats.organizations} organizations, ${stats.advisers} faculty advisers (${stats.assigned_advisers} assigned).`);

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
