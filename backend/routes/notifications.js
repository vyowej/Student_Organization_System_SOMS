/**
 * User Notifications Routes (backend/routes/notifications.js)
 *
 * Links to the `notifications` table in ../database/student_org_db.sql.
 */
const express = require('express');
const router = express.Router();
const db = require('../db');

/**
 * Automatically ensures that active published announcements and events applicable
 * to the user (by scope, college, or organization membership/advisement) are
 * synchronized into the user's notifications.
 */
async function syncUserNotifications(userId) {
  if (!userId || !Number.isFinite(Number(userId))) return;
  const uid = Number(userId);

  try {
    const userRes = await db.query(
      `SELECT u.id, u.role, s.id AS student_record_id, d.college_id AS student_college_id, a.college_id AS adviser_college_id
         FROM users u
    LEFT JOIN students s ON s.user_id = u.id
    LEFT JOIN programs p ON p.id = s.program_id
    LEFT JOIN departments d ON d.id = p.department_id
    LEFT JOIN advisers a ON a.user_id = u.id
        WHERE u.id = $1`,
      [uid]
    );

    if (userRes.rows.length === 0) return;
    const user = userRes.rows[0];
    const isAdviserOnly = user.role === 'ADVISER';

    // 1. Announcements sync (published announcements)
    let annQuery = `
      SELECT a.id, a.title, a.content, a.published_at, o.name AS org_name
        FROM announcements a
        JOIN organizations o ON o.id = a.organization_id
       WHERE a.published_at IS NOT NULL
         AND COALESCE(a.status, 'PUBLISHED') = 'PUBLISHED'
    `;
    const annParams = [];
    if (isAdviserOnly) {
      annParams.push(uid);
      annQuery += ` AND a.organization_id IN (
        SELECT oa.organization_id FROM organization_advisers oa JOIN advisers adv ON adv.id = oa.adviser_id WHERE adv.user_id = $1 AND oa.ended_at IS NULL
      )`;
    }

    const annRes = await db.query(annQuery, annParams);
    for (const a of annRes.rows) {
      const title = `New Announcement: ${a.title}`;
      const preview = a.content.length > 120 ? `${a.content.slice(0, 120)}...` : a.content;
      const message = `${a.org_name}: "${preview}"`;
      const notifExists = await db.query(
        'SELECT id FROM notifications WHERE user_id = $1 AND type = $2 AND LOWER(title) = LOWER($3) LIMIT 1',
        [uid, 'ANNOUNCEMENT', title]
      );
      if (notifExists.rows.length === 0) {
        await db.query(
          `INSERT INTO notifications (user_id, type, title, message, created_at)
           VALUES ($1, 'ANNOUNCEMENT', $2, $3, COALESCE($4, now()))`,
          [uid, title, message, a.published_at || new Date().toISOString()]
        );
      }
    }

    // 2. Events sync (approved & published events)
    let evQuery = `
      SELECT e.id, e.title, e.start_date, o.name AS org_name
        FROM events e
        JOIN organizations o ON o.id = e.organization_id
       WHERE e.status IN ('PUBLISHED', 'APPROVED')
    `;
    const evParams = [];
    if (isAdviserOnly) {
      evParams.push(uid);
      evQuery += ` AND e.organization_id IN (
        SELECT oa.organization_id FROM organization_advisers oa JOIN advisers adv ON adv.id = oa.adviser_id WHERE adv.user_id = $1 AND oa.ended_at IS NULL
      )`;
    }

    const evRes = await db.query(evQuery, evParams);
    for (const ev of evRes.rows) {
      const title = `New Event: ${ev.title}`;
      const startDate = ev.start_date
        ? new Date(ev.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : 'Upcoming';
      const message = `${ev.org_name} published a new event: "${ev.title}" on ${startDate}. Registration is now open!`;
      const notifExists = await db.query(
        'SELECT id FROM notifications WHERE user_id = $1 AND type = $2 AND LOWER(title) = LOWER($3) LIMIT 1',
        [uid, 'EVENT', title]
      );
      if (notifExists.rows.length === 0) {
        await db.query(
          `INSERT INTO notifications (user_id, type, title, message, created_at)
           VALUES ($1, 'EVENT', $2, $3, now())`,
          [uid, title, message]
        );
      }
    }
  } catch (err) {
    console.error('[SYNC USER NOTIFICATIONS ERROR]', err);
  }
}

// GET /api/notifications — List notifications across users or filtered by user_id / unread
router.get('/', async (req, res) => {
  try {
    const { user_id, unread } = req.query;

    if (user_id && Number.isFinite(Number(user_id))) {
      await syncUserNotifications(Number(user_id));
    }

    let queryText = `
      SELECT n.*,
             u.email,
             u.first_name,
             u.last_name,
             u.role
        FROM notifications n
   LEFT JOIN users u ON u.id = n.user_id
       WHERE 1=1
    `;
    const params = [];

    if (user_id && Number.isFinite(Number(user_id))) {
      params.push(Number(user_id));
      queryText += ` AND n.user_id = $${params.length}`;
    }
    if (unread === 'true') {
      queryText += ' AND n.read_at IS NULL';
    }

    queryText += ' ORDER BY n.created_at DESC';

    const result = await db.query(queryText, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/notifications/user/:user_id — List notifications for a user (optional ?unread=true filter)
router.get('/user/:user_id', async (req, res) => {
  try {
    const { user_id } = req.params;
    const { unread } = req.query;

    if (!Number.isFinite(Number(user_id))) {
      return res.json([]);
    }

    await syncUserNotifications(Number(user_id));

    let queryText = 'SELECT * FROM notifications WHERE user_id = $1';
    const params = [Number(user_id)];

    if (unread === 'true') {
      queryText += ' AND read_at IS NULL';
    }

    queryText += ' ORDER BY created_at DESC';

    const result = await db.query(queryText, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/notifications/user/:user_id/count — Count unread notifications (uses idx_notifications_user_unread)
router.get('/user/:user_id/count', async (req, res) => {
  try {
    const { user_id } = req.params;
    if (!Number.isFinite(Number(user_id))) {
      return res.json({ unread_count: 0 });
    }

    await syncUserNotifications(Number(user_id));

    const result = await db.query(
      'SELECT COUNT(*) as unread_count FROM notifications WHERE user_id = $1 AND read_at IS NULL',
      [Number(user_id)]
    );
    res.json({ unread_count: parseInt(result.rows[0].unread_count, 10) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/notifications/:id/read — Mark a single notification as read
router.put('/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      'UPDATE notifications SET read_at = now() WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/notifications/user/:user_id/read-all — Mark all unread notifications for a user as read
router.put('/user/:user_id/read-all', async (req, res) => {
  try {
    const { user_id } = req.params;
    if (!Number.isFinite(Number(user_id))) {
      return res.json({ message: 'No notifications to update', updated_count: 0 });
    }
    const result = await db.query(
      'UPDATE notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL RETURNING id',
      [Number(user_id)]
    );
    res.json({ message: 'All notifications marked as read', updated_count: result.rowCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/notifications — Create a new notification for a user
router.post('/', async (req, res) => {
  try {
    const { user_id, role, type, title, message } = req.body;

    if (!title || !message) {
      return res.status(400).json({ error: 'title and message are required' });
    }

    let resolvedUserId = user_id && Number.isFinite(Number(user_id)) ? Number(user_id) : null;
    if (!resolvedUserId && role) {
      const roleLookup = await db.query('SELECT id FROM users WHERE role = $1 ORDER BY id ASC LIMIT 1', [String(role).toUpperCase()]);
      if (roleLookup.rows.length > 0) resolvedUserId = roleLookup.rows[0].id;
    }
    if (!resolvedUserId) {
      const anyUser = await db.query('SELECT id FROM users ORDER BY id ASC LIMIT 1');
      if (anyUser.rows.length > 0) resolvedUserId = anyUser.rows[0].id;
    }

    if (!resolvedUserId) {
      return res.status(400).json({ error: 'No target user_id found for notification' });
    }

    const result = await db.query(
      `INSERT INTO notifications (user_id, type, title, message, created_at)
       VALUES ($1, $2, $3, $4, now())
       RETURNING *`,
      [resolvedUserId, (type || 'SYSTEM').trim(), title.trim(), message.trim()]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/notifications/:id — Delete a notification by ID
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('DELETE FROM notifications WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    res.json({ message: 'Notification deleted', notification: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
