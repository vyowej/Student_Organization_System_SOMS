/**
 * User Notifications Routes (backend/routes/notifications.js)
 *
 * Links to the `notifications` table in ../database/student_org_db.sql.
 */
const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/notifications/user/:user_id — List notifications for a user (optional ?unread=true filter)
router.get('/user/:user_id', async (req, res) => {
  try {
    const { user_id } = req.params;
    const { unread } = req.query;

    let queryText = 'SELECT * FROM notifications WHERE user_id = $1';
    const params = [user_id];

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
    const result = await db.query(
      'SELECT COUNT(*) as unread_count FROM notifications WHERE user_id = $1 AND read_at IS NULL',
      [user_id]
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
    const result = await db.query(
      'UPDATE notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL RETURNING id',
      [user_id]
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
    const { user_id, type, title, message } = req.body;

    if (!user_id || !type || !title || !message) {
      return res.status(400).json({ error: 'user_id, type, title, and message are required' });
    }

    const result = await db.query(
      `INSERT INTO notifications (user_id, type, title, message, created_at)
       VALUES ($1, $2, $3, $4, now())
       RETURNING *`,
      [user_id, type.trim(), title.trim(), message.trim()]
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

