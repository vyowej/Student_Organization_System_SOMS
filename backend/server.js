/**
 * SOMS Express Backend Server (backend/server.js)
 *
 * Entry point for the Student Organization Management System REST API.
 * Mounts all resource routers and verifies the link to PostgreSQL and
 * ../database/student_org_db.sql on startup.
 */
const path = require('path');
const express = require('express');
const cors = require('cors');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { testConnection, SCHEMA_PATH, query } = require('./db');

const app = express();

// Global middleware: enable CORS for frontend requests and parse JSON/urlencoded request bodies
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ============================================================
// [GOOGLE DRIVE API PLACEHOLDER — IMAGE & FILE STORAGE]
// Insert Google Drive API client setup and upload route here
// when connecting Google Drive for organization logos, event
// banners, and supporting documents.
//
// Example placeholder space:
//
//
//
// ============================================================

// Mount REST API route modules mapped to database/student_org_db.sql tables
app.use('/api/users', require('./routes/users'));
app.use('/api/organizations', require('./routes/organizations'));
app.use('/api/events', require('./routes/events'));
app.use('/api/members', require('./routes/members'));
app.use('/api/academic', require('./routes/academic'));
app.use('/api/attendance', require('./routes/attendance'));
app.use('/api/documents', require('./routes/documents'));
app.use('/api/announcements', require('./routes/announcements'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/advisers', require('./routes/advisers'));
app.use('/api/audit-logs', require('./routes/auditLogs'));
app.use('/api/settings', require('./routes/settings'));

// Root status endpoint
app.get('/', (req, res) => {
  res.send('SOMS API is running...');
});

// Health & database schema link diagnostic endpoint
app.get('/api/health', async (req, res) => {
  const dbStatus = await testConnection();
  res.json({
    status: dbStatus.connected ? 'healthy' : 'degraded',
    api: 'running',
    database: dbStatus,
  });
});

// Start HTTP server and log database link status
const PORT = process.env.PORT || 5000;
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Linked Database Schema: ${SCHEMA_PATH}`);

  const dbStatus = await testConnection();
  if (dbStatus.connected) {
    console.log(`Database Connected: successfully linked to "${dbStatus.database}"`);

    // Ensure default administrator account is immediately available
    try {
      const bcrypt = require('bcryptjs');
      const adminCheck = await query(`SELECT id FROM users WHERE lower(trim(email)) = 'admin@wmsu.edu.ph' LIMIT 1`);
      if (adminCheck.rows.length === 0) {
        const adminHash = await bcrypt.hash('admin123', 10);
        await query(
          `INSERT INTO users (email, password_hash, first_name, last_name, role, status)
           VALUES ('admin@wmsu.edu.ph', $1, 'System', 'Administrator', 'ADMIN', 'ACTIVE')
           ON CONFLICT (email) DO NOTHING`,
          [adminHash]
        );
        console.log('[AUTO-SEED] Default administrator account ready: admin@wmsu.edu.ph (Password: admin123)');
      }
    } catch (seedErr) {
      console.log('[SEED NOTICE] Users table check skipped:', seedErr.message);
    }
  } else {
    console.log(`Database Notice: Not connected yet (${dbStatus.error}). Run "npm run db:init" once PostgreSQL is ready.`);
  }
});

module.exports = app;

