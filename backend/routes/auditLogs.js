/**
 * System Audit Logs Routes (backend/routes/auditLogs.js)
 *
 * Links to the `audit_logs` table in ../database/student_org_db.sql.
 */
const express = require('express');
const router = express.Router();
const db = require('../db');
const { recordAuditLog } = require('../notificationsHelper');

// GET /api/audit-logs — Query system audit trail with optional filters, search, and pagination
router.get('/', async (req, res) => {
  try {
    const { user_id, entity, entity_type, entity_id, action, search, limit = 500, offset = 0 } = req.query;

    let queryText = `
      SELECT al.*,
             u.email,
             u.first_name,
             u.middle_name,
             u.last_name,
             u.suffix,
             CASE WHEN u.id IS NOT NULL THEN (u.last_name || ', ' || u.first_name || COALESCE(' ' || u.suffix, '')) ELSE NULL END AS actor_name,
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
    const targetEntity = entity || entity_type;
    if (targetEntity && targetEntity !== 'All') {
      params.push(targetEntity.toLowerCase());
      queryText += ` AND LOWER(al.entity) = $${params.length}`;
    }
    if (entity_id) {
      params.push(entity_id);
      queryText += ` AND al.entity_id = $${params.length}`;
    }
    if (action && action !== 'All') {
      params.push(action);
      queryText += ` AND al.action = $${params.length}`;
    }
    if (search && search.trim()) {
      params.push(`%${search.trim().toLowerCase()}%`);
      queryText += ` AND (
        LOWER(al.action) LIKE $${params.length}
        OR LOWER(al.entity) LIKE $${params.length}
        OR LOWER(COALESCE(u.first_name, '')) LIKE $${params.length}
        OR LOWER(COALESCE(u.last_name, '')) LIKE $${params.length}
        OR LOWER(COALESCE(al.metadata->>'description', '')) LIKE $${params.length}
        OR CAST(al.entity_id AS TEXT) LIKE $${params.length}
      )`;
    }

    queryText += ' ORDER BY al.created_at DESC, al.id DESC';

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
    const { user_id, action, entity, entity_type, entity_id, metadata, details, ip_address } = req.body;

    const targetAction = action ? action.trim() : null;
    const targetEntity = (entity || entity_type || 'SYSTEM').trim();

    if (!targetAction) {
      return res.status(400).json({ error: 'action is required' });
    }

    const payload = metadata || details || {};
    const logRecord = await recordAuditLog({
      userId: user_id,
      action: targetAction,
      entity: targetEntity,
      entityId: entity_id,
      metadata: payload,
      ipAddress: ip_address,
      req,
    });

    const fullLog = await db.query(
      `SELECT al.*,
              u.email,
              u.first_name,
              u.middle_name,
              u.last_name,
              u.suffix,
              CASE WHEN u.id IS NOT NULL THEN (u.last_name || ', ' || u.first_name || COALESCE(' ' || u.suffix, '')) ELSE NULL END AS actor_name,
              u.role
         FROM audit_logs al
    LEFT JOIN users u ON u.id = al.user_id
        WHERE al.id = $1`,
      [logRecord?.id]
    );

    res.status(201).json(fullLog.rows[0] || logRecord);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

module.exports = router;
