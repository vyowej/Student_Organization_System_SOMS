/**
 * User Notifications Routes (backend/routes/notifications.js)
 *
 * Links to the `notifications` table in ../database/student_org_db.sql.
 */
const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/notifications — List notifications across users or filtered by user_id / unread
router.get('/', async (req, res) => {
  try {
    const { user_id, unread } = req.query;
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
