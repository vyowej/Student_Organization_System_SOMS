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
async function recordAuditLog({ userId, action, entity, entityId, metadata = {} }) {
  try {
    const validUserId = userId && Number.isFinite(Number(userId)) ? Number(userId) : null;
    const result = await db.query(
      `INSERT INTO audit_logs (user_id, action, entity, entity_id, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, now())
       RETURNING *`,
      [
        validUserId,
        action || 'ACTION',
        entity || 'system',
        entityId ? String(entityId) : null,
        JSON.stringify(metadata),
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
