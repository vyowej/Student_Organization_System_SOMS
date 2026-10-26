/**
 * Notifications & Audit Logs Helper (backend/notificationsHelper.js)
 *
 * Provides centralized helper functions to dispatch database notifications
 * and record audit logs across officers, faculty advisers, administrators,
 * and students.
 */
const db = require('./db');

/**
 * Dispatches a notification to a specific user by database user_id (users.id).
 */
async function notifyUser(userId, { type, title, message }) {
  if (!userId || !Number.isFinite(Number(userId))) return null;
  try {
    const result = await db.query(
      `INSERT INTO notifications (user_id, type, title, message, created_at)
       VALUES ($1, $2, $3, $4, now())
       RETURNING *`,
      [Number(userId), type || 'SYSTEM', title || 'Notification', message || '']
    );
    return result.rows[0];
  } catch (err) {
    console.error('[NOTIFY USER ERROR]', err.message);
    return null;
  }
}

/**
 * Dispatches a notification to all active faculty advisers assigned to an organization.
 */
async function notifyAdvisersForOrg(organizationId, { type, title, message }) {
  if (!organizationId) return [];
  try {
    const advRes = await db.query(
      `SELECT DISTINCT a.user_id, u.first_name, u.last_name, u.email
         FROM organization_advisers oa
         JOIN advisers a ON a.id = oa.adviser_id
         JOIN users u ON u.id = a.user_id
        WHERE oa.organization_id = $1
          AND oa.ended_at IS NULL
          AND u.status = 'ACTIVE'`,
      [organizationId]
    );

    const inserted = [];
    for (const adv of advRes.rows) {
      if (adv.user_id) {
        const notif = await notifyUser(adv.user_id, { type, title, message });
        if (notif) inserted.push(notif);
      }
    }
    return inserted;
  } catch (err) {
    console.error('[NOTIFY ADVISERS ERROR]', err.message);
    return [];
  }
}

/**
 * Dispatches a notification to all active Student Affairs Administrators.
 */
async function notifyAdmins({ type, title, message }) {
  try {
    const adminRes = await db.query(
      "SELECT id FROM users WHERE role = 'ADMIN' AND status = 'ACTIVE'"
    );
    const inserted = [];
    for (const adm of adminRes.rows) {
      const notif = await notifyUser(adm.id, { type, title, message });
      if (notif) inserted.push(notif);
    }
    return inserted;
  } catch (err) {
    console.error('[NOTIFY ADMINS ERROR]', err.message);
    return [];
  }
}

/**
 * Records an entry in the system `audit_logs` table.
 */
async function recordAuditLog({ userId, action, entity, entityId, metadata = {}, ipAddress, req }) {
  try {
    const validUserId = userId && Number.isFinite(Number(userId)) ? Number(userId) : null;
    const numericEntityId = entityId && Number.isFinite(Number(entityId)) ? Number(entityId) : null;

    let clientIp = ipAddress;
    if (!clientIp && req) {
      const xForwarded = req.headers?.['x-forwarded-for'];
      clientIp = typeof xForwarded === 'string' ? xForwarded.split(',')[0].trim() : req.socket?.remoteAddress;
    }
    if (typeof clientIp === 'string') {
      clientIp = clientIp.trim().replace(/^::ffff:/, '');
    }
    if (clientIp === '::1') clientIp = '127.0.0.1';
    if (!clientIp || !/^[\da-fA-F:.]+$/.test(clientIp)) clientIp = '127.0.0.1';

    const cleanMeta = metadata && typeof metadata === 'object' ? { ...metadata } : {};
    if (entityId && numericEntityId === null && !cleanMeta.refId) {
      cleanMeta.refId = String(entityId);
    }

    if (!cleanMeta.description) {
      const actStr = String(action || 'ACTION').replaceAll('_', ' ');
      cleanMeta.description = `${actStr} on ${entity || 'system'}${entityId ? ` #${entityId}` : ''}.`;
    }

    const result = await db.query(
      `INSERT INTO audit_logs (user_id, action, entity, entity_id, metadata, ip_address, created_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::inet, now())
       RETURNING *`,
      [
        validUserId,
        action || 'ACTION',
        entity || 'system',
        numericEntityId,
        JSON.stringify(cleanMeta),
        clientIp,
      ]
    );
    return result.rows[0];
  } catch (err) {
    console.error('[AUDIT LOG ERROR]', err.message);
    return null;
  }
}

module.exports = {
  notifyUser,
  notifyAdvisersForOrg,
  notifyAdmins,
  recordAuditLog,
};
