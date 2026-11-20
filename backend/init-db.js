/**
 * Database Initialization & Schema Link Runner (backend/init-db.js)
 *
 * Reads the SQL schema from ../database/student_org_db.sql (resolved via ./db)
 * and applies all ENUM types, tables, constraints, triggers, indexes, and seed
 * data (Colleges, Departments, Programs, Organizations) to PostgreSQL.
 */
const fs = require('fs');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const { SCHEMA_PATH: DB_SCHEMA_PATH, ensureEnvFile, getDbConfig } = require('./db');

const SAFE_DB_IDENTIFIER = /^[a-zA-Z0-9_]+$/;
const REQUIRED_SCHEMA_TABLES = [
  'colleges',
  'departments',
  'programs',
  'users',
  'students',
  'advisers',
  'organizations',
  'organization_advisers',
  'adviser_change_requests',
  'organization_requests',
  'organization_members',
  'organization_applications',
  'events',
  'event_registrations',
  'attendance',
  'documents',
  'announcements',
  'notifications',
  'audit_logs',
  'system_settings',
  'password_reset_requests',
];

const LEGACY_PLACEHOLDER_ADVISER_HASH = '$2b$10$YtC9QkW56A0.gsroDeUstueoAUsaEz/VqiXMMt3Zbg/J1BMEIp1ZO';

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
  // Grant Coordinator privilege to Engr. Marjorie A. Rojas (Ma'am Marj) so she can prepare/create adviser accounts beforehand
  await client.query(`
    UPDATE advisers a
       SET is_coordinator = true
      FROM users u
     WHERE u.id = a.user_id
       AND lower(u.email) = 'marjorie.rojas@wmsu.edu.ph'
  `);

  const legacyPlaceholder = await client.query(
    `SELECT 1 FROM users WHERE role = 'ADVISER' AND password_hash = $1 LIMIT 1`,
    [LEGACY_PLACEHOLDER_ADVISER_HASH]
  );

  // Pre-generate faculty adviser accounts for any active/pending organizations that lack an assigned adviser
  const unassignedOrgs = await client.query(`
    SELECT o.id, o.name, o.acronym, o.college_id
      FROM organizations o
     WHERE NOT EXISTS (
       SELECT 1 FROM organization_advisers oa
        WHERE oa.organization_id = o.id AND oa.ended_at IS NULL
     )
     ORDER BY o.id ASC
  `);

  if (legacyPlaceholder.rows.length === 0 && unassignedOrgs.rows.length === 0) {
    return;
  }

  const adviserHash = await bcrypt.hash('adviser123', 10);

  if (legacyPlaceholder.rows.length > 0) {
    await client.query(
      `UPDATE users
          SET password_hash = $1, status = 'ACTIVE'
        WHERE role = 'ADVISER'
          AND password_hash = $2`,
      [adviserHash, LEGACY_PLACEHOLDER_ADVISER_HASH]
    );
  }

  for (const org of unassignedOrgs.rows) {
    const rawSlug = (org.acronym || org.name || `org${org.id}`)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '')
      .slice(0, 22) || `org${org.id}`;
    const email = `adviser.${rawSlug}.${org.id}@wmsu.edu.ph`;
    const empNum = `EMP-PREP-${String(org.id).padStart(3, '0')}`;
    const label = org.acronym || org.name.split(/\s+/).slice(0, 3).join(' ');

    const uRes = await client.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, role, status)
       VALUES ($1, $2, $3, $4, 'ADVISER', 'ACTIVE')
       ON CONFLICT (lower(email)) DO UPDATE SET status = 'ACTIVE'
       RETURNING id`,
      [email, adviserHash, `${label} Adviser`, '(Prepared)']
    );
    const advUserId = uRes.rows[0].id;

    const aRes = await client.query(
      `INSERT INTO advisers (user_id, employee_number, title, college_id)
       VALUES ($1, $2, 'Prof.', $3)
       ON CONFLICT (user_id) DO UPDATE
         SET employee_number = COALESCE(advisers.employee_number, EXCLUDED.employee_number),
             college_id = COALESCE(advisers.college_id, EXCLUDED.college_id)
       RETURNING id`,
      [advUserId, empNum, org.college_id || null]
    );

    await client.query(
      `INSERT INTO organization_advisers (organization_id, adviser_id, assigned_at)
       VALUES ($1, $2, now())
       ON CONFLICT (organization_id) WHERE ended_at IS NULL DO NOTHING`,
      [org.id, aRes.rows[0].id]
    );
  }
}

async function applyIncrementalMigrations(client, { verbose = true } = {}) {
  const log = (...args) => {
    if (verbose) console.log(...args);
  };

  log('[MIGRATE] Ensuring education_level and organization categories types are registered...');
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

  log('[MIGRATE] Ensuring eligibility columns and adviser titles exist...');
  await client.query(`
    ALTER TABLE advisers
      ADD COLUMN IF NOT EXISTS title VARCHAR(50),
      ADD COLUMN IF NOT EXISTS is_coordinator BOOLEAN NOT NULL DEFAULT false;

    ALTER TABLE students
      ADD COLUMN IF NOT EXISTS cor_file_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS cor_file_data TEXT;

    ALTER TABLE programs
      ADD COLUMN IF NOT EXISTS level education_level NOT NULL DEFAULT 'UNDERGRADUATE';

    ALTER TABLE organizations
      ADD COLUMN IF NOT EXISTS mission TEXT,
      ADD COLUMN IF NOT EXISTS vision TEXT,
      ADD COLUMN IF NOT EXISTS official_email VARCHAR(255),
      ADD COLUMN IF NOT EXISTS contact_number VARCHAR(50),
      ADD COLUMN IF NOT EXISTS social_media TEXT,
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

    -- Ensure organization_members committee column
    ALTER TABLE organization_members
      ADD COLUMN IF NOT EXISTS committee VARCHAR(120);

    -- Ensure events capacity, compliance upload, category, budget, audience, remarks, and approval columns
    ALTER TABLE events
      ADD COLUMN IF NOT EXISTS category VARCHAR(100),
      ADD COLUMN IF NOT EXISTS compliance_file_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS compliance_file_data TEXT,
      ADD COLUMN IF NOT EXISTS supporting_documents JSONB NOT NULL DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS max_participants INTEGER,
      ADD COLUMN IF NOT EXISTS target_audience TEXT,
      ADD COLUMN IF NOT EXISTS registration_deadline DATE,
      ADD COLUMN IF NOT EXISTS budget NUMERIC(12, 2),
      ADD COLUMN IF NOT EXISTS review_remarks TEXT;

    -- Ensure documents store uploaded filename & content bytes alongside Drive metadata
    ALTER TABLE documents
      ADD COLUMN IF NOT EXISTS file_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS file_data TEXT;

    -- Ensure adviser transition requests table exists
    CREATE TABLE IF NOT EXISTS adviser_change_requests (
      id                  INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      organization_id     INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      current_adviser_id  INTEGER REFERENCES advisers(id),
      proposed_adviser_id INTEGER REFERENCES advisers(id),
      requested_by        INTEGER REFERENCES users(id) ON DELETE SET NULL,
      reason              TEXT NOT NULL,
      status              change_request_status NOT NULL DEFAULT 'PENDING',
      reviewed_by         INTEGER REFERENCES users(id) ON DELETE SET NULL,
      review_remarks      TEXT,
      created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
      reviewed_at         TIMESTAMPTZ,
      CHECK (current_adviser_id IS DISTINCT FROM proposed_adviser_id)
    );

    CREATE UNIQUE INDEX IF NOT EXISTS uq_one_pending_change_request
      ON adviser_change_requests (organization_id)
      WHERE status = 'PENDING';

    -- Ensure organization governance / deactivation requests table exists
    CREATE TABLE IF NOT EXISTS organization_requests (
      id              INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      request_type    VARCHAR(50) NOT NULL DEFAULT 'DEACTIVATION',
      requested_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
      reason          TEXT NOT NULL,
      status          change_request_status NOT NULL DEFAULT 'PENDING',
      reviewed_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
      review_remarks  TEXT,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
      reviewed_at     TIMESTAMPTZ
    );

    CREATE UNIQUE INDEX IF NOT EXISTS uq_one_pending_org_request
      ON organization_requests (organization_id, request_type)
      WHERE status = 'PENDING';

    -- Ensure password reset requests table exists
    CREATE TABLE IF NOT EXISTS password_reset_requests (
      id                   INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      user_id              INTEGER REFERENCES users(id) ON DELETE CASCADE,
      email                VARCHAR(255) NOT NULL,
      requested_identifier VARCHAR(120),
      status               VARCHAR(20) NOT NULL DEFAULT 'PENDING',
      reason               TEXT,
      resolved_by          INTEGER REFERENCES users(id) ON DELETE SET NULL,
      review_remarks       TEXT,
      created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
      resolved_at          TIMESTAMPTZ
    );

    -- Ensure event_registrations qr_code default
    ALTER TABLE event_registrations
      ALTER COLUMN qr_code SET DEFAULT ('UNIDOS-QR-' || md5(random()::text || clock_timestamp()::text));

    -- Ensure attendance dual-column compatibility
    ALTER TABLE attendance
      ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMPTZ DEFAULT now(),
      ADD COLUMN IF NOT EXISTS recorded_by INTEGER REFERENCES users(id) ON DELETE SET NULL;

    UPDATE attendance
       SET checked_in_at = COALESCE(checked_in_at, scanned_at)
     WHERE checked_in_at IS NULL;

    UPDATE attendance
       SET recorded_by = COALESCE(recorded_by, verified_by)
     WHERE recorded_by IS NULL;

    -- Ensure organization_applications review remarks and COR file columns
    ALTER TABLE organization_applications
      ADD COLUMN IF NOT EXISTS cor_file_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS cor_file_data TEXT,
      ADD COLUMN IF NOT EXISTS review_remarks TEXT;

    -- Ensure announcements author, creator, draft status, and pin compatibility
    ALTER TABLE announcements
      ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'PUBLISHED',
      ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT false;
    ALTER TABLE announcements
      ALTER COLUMN published_at DROP NOT NULL;

    UPDATE announcements
       SET created_by = COALESCE(created_by, author_id)
     WHERE created_by IS NULL;

    UPDATE announcements
       SET author_id = COALESCE(author_id, created_by)
     WHERE author_id IS NULL;
  `);

  log('[MIGRATE] Updating student_can_join eligibility validation function...');
  await client.query(`
    CREATE OR REPLACE FUNCTION student_can_join(p_org_id INTEGER, p_student_id INTEGER)
RETURNS BOOLEAN AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM organizations WHERE id = p_org_id) THEN
        RETURN FALSE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM students WHERE id = p_student_id) THEN
        RETURN FALSE;
    END IF;
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql STABLE;
  `);

  await client.query(`
    DELETE FROM audit_logs
     WHERE metadata->>'description' IN (
          'WMSU UNIDOS Student Organization Management System initialized successfully.',
          'Updated active academic calendar to AY 2025-2026 and configured organization categories.',
          'Accreditation granted for Academic Year 2025-2026.',
          'Assigned as official organization adviser.',
          'New student account registered and verified via WMSU email domain.',
          'Event proposal approved for university-wide hosting.',
          'Official announcement published to student portals.',
          'Student attendance verified via digital QR pass.',
          'Organization constitution and by-laws compliance approved.',
          'Student Affairs Admin authenticated via administrative portal.'
        );
  `);
}

function formatDatabaseHint(err, dbConfig) {
  if (err.code === '3D000') {
    return `Hint: The database "${dbConfig.database}" could not be accessed or created. Ensure PostgreSQL user '${dbConfig.user}' has CREATEDB permission or create it manually: CREATE DATABASE ${dbConfig.database};`;
  }
  if (err.code === 'ECONNREFUSED') {
    return `Hint: Could not connect to PostgreSQL at ${dbConfig.host}:${dbConfig.port}. Ensure the PostgreSQL service is running.`;
  }
  if (err.code === '28P01') {
    return `Hint: PostgreSQL authentication failed for user '${dbConfig.user}'. Update DB_USER and DB_PASSWORD in backend/.env to match your local PostgreSQL setup.`;
  }
  return null;
}

async function ensureDatabaseExists(dbConfig, log = console.log) {
  if (!SAFE_DB_IDENTIFIER.test(dbConfig.database)) {
    throw new Error(`Invalid DB_NAME "${dbConfig.database}". Only letters, numbers, and underscores are allowed.`);
  }

  const probePool = new Pool(dbConfig);
  try {
    await probePool.query('SELECT 1');
    return false;
  } catch (err) {
    if (err.code !== '3D000') {
      throw err;
    }

    const adminDb = process.env.DB_ADMIN_DB || 'postgres';
    const adminPool = new Pool({ ...dbConfig, database: adminDb });
    try {
      const existsRes = await adminPool.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbConfig.database]);
      if (existsRes.rows.length === 0) {
        await adminPool.query(`CREATE DATABASE "${dbConfig.database}"`);
        log(`[AUTO-DB] Created PostgreSQL database "${dbConfig.database}".`);
      }
      return true;
    } catch (createErr) {
      if (createErr.code === '42P04') {
        return false;
      }
      throw createErr;
    } finally {
      await adminPool.end();
    }
  } finally {
    await probePool.end();
  }
}

async function syncCanonicalSeedData(client, sqlContent) {
  const seedMarker = '-- 10. CANONICAL WMSU SEED DATA';
  const seedIndex = sqlContent.indexOf(seedMarker);
  if (seedIndex !== -1) {
    await client.query(sqlContent.slice(seedIndex));
  }
}

async function fetchDatabaseStats(client) {
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
  return counts.rows[0];
}

/**
 * Ensures PostgreSQL database, schema tables, incremental migrations,
 * canonical seed data, default admin, and prepared adviser accounts exist.
 * Safe to run automatically on every server startup.
 */
async function ensureDatabaseReady({ verbose = false, alwaysSyncSeed = false } = {}) {
  const log = (...args) => {
    if (verbose) console.log(...args);
  };

  const { envPath, created: envCreated } = ensureEnvFile();
  if (envCreated) {
    console.log(`[AUTO-DB] Created ${envPath} from backend/.env.example.`);
  }

  if (!fs.existsSync(DB_SCHEMA_PATH)) {
    throw new Error(`Schema file not found at ${DB_SCHEMA_PATH}. Verify that database/student_org_db.sql exists.`);
  }

  const dbConfig = getDbConfig();
  log(`[LINK] Resolving schema file at: ${DB_SCHEMA_PATH}`);
  log(`[CONNECT] Connecting to PostgreSQL at ${dbConfig.host}:${dbConfig.port}/${dbConfig.database} as user '${dbConfig.user}'...`);

  const dbCreated = await ensureDatabaseExists(dbConfig, console.log);
  const pool = new Pool(dbConfig);
  let client;
  let schemaApplied = false;

  try {
    client = await pool.connect();
    log('[SUCCESS] Database connection established.');

    const tablesRes = await client.query(`
      SELECT tablename
        FROM pg_tables
       WHERE schemaname = 'public'
    `);
    const existingTables = new Set(tablesRes.rows.map((row) => row.tablename));
    const missingTables = REQUIRED_SCHEMA_TABLES.filter((table) => !existingTables.has(table));

    let sqlContent = null;
    const loadSchemaSql = () => {
      if (sqlContent === null) {
        sqlContent = fs.readFileSync(DB_SCHEMA_PATH, 'utf8');
        log(`[FILE] Loaded schema file (${sqlContent.length} bytes)`);
      }
      return sqlContent;
    };

    if (dbCreated || missingTables.length > 0) {
      schemaApplied = true;
      const schemaSql = loadSchemaSql();
      try {
        console.log('[AUTO-DB] Applying canonical PostgreSQL schema (database/student_org_db.sql)...');
        await client.query(schemaSql);
        console.log('[AUTO-DB] Schema tables, constraints, functions, and seed data applied.');
      } catch (err) {
        if (err.code === '42710' || err.code === '42P07') {
          log('[INFO] Database objects already exist cleanly. Applying incremental updates...');
          await applyIncrementalMigrations(client, { verbose });
          await syncCanonicalSeedData(client, schemaSql);
        } else {
          throw err;
        }
      }
    }

    await applyIncrementalMigrations(client, { verbose });

    if (alwaysSyncSeed) {
      await syncCanonicalSeedData(client, loadSchemaSql());
      log('[SUCCESS] Canonical colleges, departments, programs, and organizations synchronized.');
    } else {
      const seedRes = await client.query(`
        SELECT
          (SELECT COUNT(*)::int FROM colleges) AS colleges,
          (SELECT COUNT(*)::int FROM organizations) AS organizations
      `);
      if (seedRes.rows[0].colleges === 0 || seedRes.rows[0].organizations === 0) {
        await syncCanonicalSeedData(client, loadSchemaSql());
        console.log('[AUTO-DB] Seeded canonical colleges, departments, programs, and organizations.');
      }
    }

    await ensureAdminAccount(client);
    await ensureAdviserAccounts(client);

    const stats = await fetchDatabaseStats(client);
    return {
      connected: true,
      database: dbConfig.database,
      dbCreated,
      schemaApplied,
      stats,
    };
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

/**
 * CLI runner (`npm run db:init`): ensures PostgreSQL schema and seed state are synchronized.
 */
async function initializeDatabase() {
  console.log('----------------------------------------------------');
  console.log('Student Organization Management System (SOMS)');
  console.log('Database Initialization & Schema Link Runner');
  console.log('----------------------------------------------------');

  const dbConfig = getDbConfig();
  try {
    const result = await ensureDatabaseReady({ verbose: true, alwaysSyncSeed: true });
    const { stats } = result;
    console.log(`[VERIFY] System state: ${stats.tables} tables, ${stats.colleges} colleges, ${stats.departments} departments, ${stats.programs} programs, ${stats.organizations} organizations, ${stats.advisers} faculty advisers (${stats.assigned_advisers} assigned).`);
    console.log('----------------------------------------------------');
    console.log('Database is now fully linked and synchronized with backend.');
    console.log('----------------------------------------------------');
  } catch (err) {
    console.error('\n[DATABASE ERROR] Failed to initialize database:');
    console.error(err.message);
    const hint = formatDatabaseHint(err, dbConfig);
    if (hint) {
      console.error(`\n${hint}`);
    }
    process.exit(1);
  }
}

// Execute immediately if run directly via `node init-db.js` or `npm run db:init`
if (require.main === module) {
  initializeDatabase();
}

module.exports = {
  DB_SCHEMA_PATH,
  ensureDatabaseReady,
  formatDatabaseHint,
  initializeDatabase,
};
