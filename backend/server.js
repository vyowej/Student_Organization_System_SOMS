/**
 * SOMS Express Backend Server (backend/server.js)
 *
 * Entry point for the Student Organization Management System REST API.
 * Mounts all resource routers and verifies the link to PostgreSQL and
 * ../database/student_org_db.sql on startup.
 */
const http = require('node:http');
const express = require('express');
const cors = require('cors');
const { testConnection, SCHEMA_PATH, getDbConfig } = require('./db');
const { ensureDatabaseReady, formatDatabaseHint } = require('./init-db');

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

// Start HTTP server after automatically ensuring PostgreSQL database & schema are ready
const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    const dbReady = await ensureDatabaseReady({ quietIfReady: true, alwaysSyncSeed: false });
    console.log(
      `[AUTO-DB] PostgreSQL database "${dbReady.database}" ready (${dbReady.stats.tables} tables, ${dbReady.stats.organizations} organizations).`
    );
  } catch (dbErr) {
    console.error(`[DATABASE NOTICE] Auto-setup skipped (${dbErr.message}).`);
    const hint = formatDatabaseHint(dbErr, getDbConfig());
    if (hint) {
      console.error(hint);
    } else {
      console.error('Run "npm run db:init" once PostgreSQL is ready.');
    }
  }

  const server = http.createServer(app);

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[SERVER ERROR] Port ${PORT} is already in use. Stop the conflicting process or change PORT in backend/.env.`);
    } else {
      console.error(`[SERVER ERROR] Failed to start backend on port ${PORT}:`, err.message);
    }
    process.exit(1);
  });

  server.listen(PORT, '0.0.0.0', async () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Linked Database Schema: ${SCHEMA_PATH}`);

    const dbStatus = await testConnection();
    if (dbStatus.connected) {
      console.log(`Database Connected: successfully linked to "${dbStatus.database}"`);
    } else {
      console.log(`Database Notice: Not connected yet (${dbStatus.error}).`);
    }
  });

  return server;
}

if (require.main === module) {
  startServer();
}

module.exports = app;

