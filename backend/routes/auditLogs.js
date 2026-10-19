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
    const { user_id, entity, entity_id, action, limit = 50, offset = 0 } = req.query;

    let queryText = `
      SELECT al.*,
             u.email,
             u.first_name,
             u.last_name,
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

    const clientIp = ip_address || req.ip || null;
    const metaJson = metadata ? JSON.stringify(metadata) : '{}';

    const result = await db.query(
      `INSERT INTO audit_logs (user_id, action, entity, entity_id, metadata, ip_address, created_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, now())
       RETURNING *`,
      [user_id || null, action.trim(), entity.trim(), entity_id ? String(entity_id) : null, metaJson, clientIp]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

