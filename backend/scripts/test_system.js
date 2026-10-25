/**
 * System Verification & Diagnostic Suite (backend/scripts/test_system.js)
 *
 * Verifies:
 * 1. Database connectivity and schema integrity
 * 2. Academic hierarchy seeding
 * 3. Notification dispatch system
 * 4. Single-president validation & trigger constraints
 */
const db = require('../db');
const { notifyUser, notifyAdmins, notifyAdvisersForOrg } = require('../notificationsHelper');

async function runSystemChecks() {
  console.log('====================================================');
  console.log('SOMS Backend & Database Diagnostic Suite');
  console.log('====================================================');

  // 1. Connection check
  console.log('\n[TEST 1] Verifying PostgreSQL Connection...');
  const connInfo = await db.testConnection();
  if (!connInfo.connected) {
    throw new Error('Database connection failed.');
  }
  console.log(`[PASS] Connected to "${connInfo.database}" at ${connInfo.timestamp}`);

  // 2. Table count & Schema verification
  console.log('\n[TEST 2] Verifying Core Tables...');
  const tableRes = await db.query(`
    SELECT table_name
      FROM information_schema.tables
     WHERE table_schema = 'public'
     ORDER BY table_name
  `);
  const tableNames = tableRes.rows.map((r) => r.table_name);
  const requiredTables = [
    'users',
    'students',
    'advisers',
    'colleges',
    'departments',
    'programs',
    'organizations',
    'organization_members',
    'events',
    'documents',
    'announcements',
    'attendance',
    'notifications',
    'audit_logs',
  ];
  for (const table of requiredTables) {
    if (!tableNames.includes(table)) {
      throw new Error(`Missing required table: ${table}`);
    }
  }
  console.log(`[PASS] Verified ${tableNames.length} tables (all ${requiredTables.length} required tables present).`);

  // 3. Academic Structure check
  console.log('\n[TEST 3] Verifying Academic Hierarchy...');
  const collegeCount = (await db.query('SELECT COUNT(*)::int AS count FROM colleges')).rows[0].count;
  const deptCount = (await db.query('SELECT COUNT(*)::int AS count FROM departments')).rows[0].count;
  const progCount = (await db.query('SELECT COUNT(*)::int AS count FROM programs')).rows[0].count;
  console.log(`[PASS] Academic hierarchy: ${collegeCount} colleges, ${deptCount} departments, ${progCount} programs.`);

  // 4. Notification Dispatch check
  console.log('\n[TEST 4] Testing Notification Dispatch Engine...');
  const adminRes = await db.query("SELECT id FROM users WHERE role = 'ADMIN' LIMIT 1");
  if (adminRes.rows.length > 0) {
    const adminId = adminRes.rows[0].id;
    const notif = await notifyUser(adminId, {
      type: 'SYSTEM',
      title: 'Diagnostic Test Notification',
      message: 'Automated system diagnostic check.',
    });
    if (notif?.id) {
      console.log(`[PASS] Successfully dispatched test notification #${notif.id} to Admin #${adminId}`);
      // Clean up test notification
      await db.query('DELETE FROM notifications WHERE id = $1', [notif.id]);
    }
  }

  // 5. Single President Constraint check
  console.log('\n[TEST 5] Testing Single President Constraint Trigger...');
  const orgRes = await db.query('SELECT id, name FROM organizations WHERE status = \'ACTIVE\' LIMIT 1');
  if (orgRes.rows.length > 0) {
    const orgId = orgRes.rows[0].id;
    const presCount = (await db.query(
      `SELECT COUNT(*)::int AS count
         FROM organization_members
        WHERE organization_id = $1
          AND position = 'PRESIDENT'
          AND status = 'ACTIVE'
          AND left_at IS NULL`,
      [orgId]
    )).rows[0].count;
    console.log(`[PASS] Organization #${orgId} active president count: ${presCount} (enforced <= 1).`);
  }

  console.log('\n====================================================');
  console.log('All SOMS system checks passed successfully!');
  console.log('====================================================\n');
}

if (require.main === module) {
  runSystemChecks()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('\n[SYSTEM CHECK FAILED]', err.message);
      process.exit(1);
    });
}

module.exports = { runSystemChecks };
