/**
 * System Audit Logs Routes (backend/routes/auditLogs.js)
 *
 * Links to the `audit_logs` table in ../database/student_org_db.sql.
 */
const express = require('express');
const router = express.Router();
const db = require('../db');

// Auto-seed realistic initial audit entries if table is empty
async function ensureAuditLogsSeed() {
  try {
    const countRes = await db.query('SELECT count(*) FROM audit_logs');
    if (parseInt(countRes.rows[0].count, 10) > 0) return;

    const adminUser = await db.query("SELECT id, first_name, last_name, suffix, email FROM users WHERE role = 'ADMIN' LIMIT 1");
    const adviserUser = await db.query("SELECT id, first_name, last_name, suffix, email FROM users WHERE role = 'ADVISER' LIMIT 1");
    const studentUser = await db.query("SELECT id, first_name, last_name, suffix, email FROM users WHERE role = 'STUDENT' LIMIT 1");

    const adminId = adminUser.rows[0]?.id || null;
    const adviserId = adviserUser.rows[0]?.id || null;
    const studentId = studentUser.rows[0]?.id || null;

    const seedLogs = [
      {
        user_id: adminId,
        action: 'SYSTEM_INITIALIZED',
        entity: 'system',
        entity_id: null,
        metadata: { description: 'WMSU UNIDOS Student Organization Management System initialized successfully.', version: '2.5.0', environment: 'Production' },
        ip_address: '127.0.0.1',
        hours_ago: '72',
      },
      {
        user_id: adminId,
        action: 'SETTINGS_UPDATED',
        entity: 'settings',
        entity_id: null,
        metadata: { description: 'Updated active academic calendar to AY 2025-2026 and configured organization categories.', academicYear: '2025-2026', semester: 'First Semester' },
        ip_address: '127.0.0.1',
        hours_ago: '48',
      },
      {
        user_id: adminId,
        action: 'ORGANIZATION_ACCREDITED',
        entity: 'organizations',
        entity_id: 1,
        metadata: { organization_name: 'Academic Community of Civil Engineering Students', acronym: 'ACCES', status: 'ACCREDITED', description: 'Accreditation granted for Academic Year 2025-2026.' },
        ip_address: '127.0.0.1',
        hours_ago: '36',
      },
      {
        user_id: adviserId,
        action: 'ADVISER_ASSIGNED',
        entity: 'organizations',
        entity_id: 1,
        metadata: { organization_name: 'Academic Community of Civil Engineering Students', role: 'Faculty Adviser', description: 'Assigned as official organization adviser.' },
        ip_address: '192.168.1.15',
        hours_ago: '30',
      },
      {
        user_id: studentId,
        action: 'USER_REGISTERED',
        entity: 'users',
        entity_id: studentId,
        metadata: { description: 'New student account registered and verified via WMSU email domain.', role: 'STUDENT' },
        ip_address: '192.168.1.42',
        hours_ago: '24',
      },
      {
        user_id: adminId,
        action: 'EVENT_APPROVED',
        entity: 'events',
        entity_id: 101,
        metadata: { title: 'WMSU University Tech Summit 2026', organization: 'Academic Community of Civil Engineering Students', venue: 'WMSU Main Campus Gymnasium', status: 'APPROVED', description: 'Event proposal approved for university-wide hosting.' },
        ip_address: '127.0.0.1',
        hours_ago: '18',
      },
      {
        user_id: adviserId,
        action: 'ANNOUNCEMENT_PUBLISHED',
        entity: 'announcements',
        entity_id: 201,
        metadata: { title: 'First Semester General Assembly & Registration', target: 'All Engineering Students', description: 'Official announcement published to student portals.' },
        ip_address: '192.168.1.15',
        hours_ago: '12',
      },
      {
        user_id: studentId,
        action: 'ATTENDANCE_CHECKIN',
        entity: 'attendance',
        entity_id: 301,
        metadata: { event_id: 101, event_name: 'WMSU University Tech Summit 2026', method: 'QR_SCAN', description: 'Student attendance verified via digital QR pass.' },
        ip_address: '192.168.1.42',
        hours_ago: '4',
      },
      {
        user_id: adminId,
        action: 'DOCUMENT_VERIFIED',
        entity: 'documents',
        entity_id: 401,
        metadata: { document_name: 'ACCES_Constitution_and_ByLaws_2025.pdf', status: 'VERIFIED', description: 'Organization constitution and by-laws compliance approved.' },
        ip_address: '127.0.0.1',
        hours_ago: '2',
      },
      {
        user_id: adminId,
        action: 'USER_LOGIN',
        entity: 'users',
        entity_id: adminId,
        metadata: { role: 'ADMIN', description: 'Student Affairs Admin authenticated via administrative portal.' },
        ip_address: '127.0.0.1',
        hours_ago: '0.5',
      },
    ];

    for (const log of seedLogs) {
      await db.query(
        `INSERT INTO audit_logs (user_id, action, entity, entity_id, metadata, ip_address, created_at)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6::inet, now() - ($7 || ' hours')::interval)`,
        [log.user_id, log.action, log.entity, log.entity_id, JSON.stringify(log.metadata), log.ip_address, log.hours_ago]
      );
    }
  } catch (err) {
    console.error('Error auto-seeding audit logs:', err.message);
  }
}

// GET /api/audit-logs — Query system audit trail with optional filters, search, and pagination
router.get('/', async (req, res) => {
  try {
    await ensureAuditLogsSeed();
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
    const { user_id, action, entity, entity_type, entity_id, metadata, details, ip_address } = req.body;

    const targetAction = action ? action.trim() : null;
    const targetEntity = (entity || entity_type || 'SYSTEM').trim();

    if (!targetAction) {
      return res.status(400).json({ error: 'action is required' });
    }

    const validUserId = user_id && Number.isFinite(Number(user_id)) ? Number(user_id) : null;
    const validEntityId = entity_id && Number.isFinite(Number(entity_id)) ? Number(entity_id) : null;
    const clientIp = ip_address || (req.headers['x-forwarded-for'] ? req.headers['x-forwarded-for'].split(',')[0].trim() : req.socket?.remoteAddress) || '127.0.0.1';
    const payload = metadata || details || {};
    const metaJson = payload && typeof payload === 'object' ? JSON.stringify(payload) : '{}';

    const insertRes = await db.query(
      `INSERT INTO audit_logs (user_id, action, entity, entity_id, metadata, ip_address, created_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::inet, now())
       RETURNING id`,
      [validUserId, targetAction, targetEntity, validEntityId, metaJson, clientIp]
    );

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
      [insertRes.rows[0].id]
    );

    res.status(201).json(fullLog.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

module.exports = router;
