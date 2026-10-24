/**
 * System Audit Logs Routes (backend/routes/auditLogs.js)
 *
 * Links to the `audit_logs` table in ../database/student_org_db.sql.
 */
const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/audit-logs — Query system audit trail with optional filters and pagination
router.get('/', async (req, res) => {
  try {
    const { user_id, entity, entity_id, action, limit = 100, offset = 0 } = req.query;

    let queryText = `
      SELECT al.*,
             u.email,
             u.first_name,
             u.last_name,
             CASE WHEN u.id IS NOT NULL THEN (u.last_name || ', ' || u.first_name) ELSE NULL END AS actor_name,
             u.role
        FROM audit_logs al
   LEFT JOIN users u ON u.id = al.user_id
       WHERE 1=1
    `;
    const params = [];

    if (user_id) {
      params.push(user_id);
      queryText += ` AND al.user_id = $${params.length}`;
    }
    if (entity) {
      params.push(entity);
      queryText += ` AND al.entity = $${params.length}`;
    }
    if (entity_id) {
      params.push(entity_id);
      queryText += ` AND al.entity_id = $${params.length}`;
    }
    if (action) {
      params.push(action);
      queryText += ` AND al.action = $${params.length}`;
    }

    queryText += ' ORDER BY al.created_at DESC';

    params.push(parseInt(limit, 10));
    queryText += ` LIMIT $${params.length}`;

    params.push(parseInt(offset, 10));
    queryText += ` OFFSET $${params.length}`;

    const result = await db.query(queryText, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/audit-logs — Record a new audit log entry with JSONB metadata and client IP
router.post('/', async (req, res) => {
  try {
    const { user_id, action, entity, entity_id, metadata, ip_address } = req.body;

    if (!action || !entity) {
      return res.status(400).json({ error: 'action and entity are required' });
    }

    const validUserId = user_id && Number.isFinite(Number(user_id)) ? Number(user_id) : null;
    const clientIp = ip_address || '127.0.0.1';
    const metaJson = metadata && typeof metadata === 'object' ? JSON.stringify(metadata) : '{}';

    const insertRes = await db.query(
      `INSERT INTO audit_logs (user_id, action, entity, entity_id, metadata, ip_address, created_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::inet, now())
       RETURNING id`,
      [validUserId, action.trim(), entity.trim(), entity_id ? String(entity_id) : null, metaJson, clientIp]
    );

    const fullLog = await db.query(
      `SELECT al.*,
              u.email,
              u.first_name,
              u.last_name,
              CASE WHEN u.id IS NOT NULL THEN (u.last_name || ', ' || u.first_name) ELSE NULL END AS actor_name,
              u.role
         FROM audit_logs al
    LEFT JOIN users u ON u.id = al.user_id
        WHERE al.id = $1`,
      [insertRes.rows[0].id]
    );

    res.status(201).json(fullLog.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

module.exports = router;
