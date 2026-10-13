const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { testConnection, SCHEMA_PATH } = require('./db');

const app = express();

app.use(cors());
app.use(express.json());

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

app.get('/', (req, res) => {
  res.send('SOMS API is running...');
});

app.get('/api/health', async (req, res) => {
  const dbStatus = await testConnection();
  res.json({
    status: dbStatus.connected ? 'healthy' : 'degraded',
    api: 'running',
    database: dbStatus,
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Linked Database Schema: ${SCHEMA_PATH}`);

  const dbStatus = await testConnection();
  if (dbStatus.connected) {
    console.log(`Database Connected: successfully linked to "${dbStatus.database}"`);
  } else {
    console.log(`Database Notice: Not connected yet (${dbStatus.error}). Run "npm run db:init" once PostgreSQL is ready.`);
  }
});
