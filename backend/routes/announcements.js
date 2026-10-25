/**
 * Organization Announcements Routes (backend/routes/announcements.js)
 *
 * Links to the `announcements` table in ../database/student_org_db.sql.
 */
const express = require('express');
const router = express.Router();
const db = require('../db');
const {
  notifyUser,
  notifyAdvisersForOrg,
} = require('../notificationsHelper');

// GET /api/announcements — List announcements across organizations (newest first)
router.get('/', async (req, res) => {
  try {
    const { organization_id, limit } = req.query;
    let queryText = `
      SELECT a.*,
             o.name    AS organization_name,
             o.acronym AS organization_acronym,
             o.logo    AS organization_logo,
             u.first_name AS author_first_name,
             u.last_name  AS author_last_name
        FROM announcements a
        JOIN organizations o ON o.id = a.organization_id
   LEFT JOIN users u         ON u.id = a.created_by
    `;
    const params = [];

    if (organization_id) {
      queryText += ' WHERE a.organization_id = $1';
      params.push(organization_id);
    }

    queryText += ' ORDER BY a.published_at DESC';

    if (limit) {
      params.push(parseInt(limit, 10));
      queryText += ` LIMIT $${params.length}`;
    }

    const result = await db.query(queryText, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/announcements/:id — Fetch a single announcement by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      `SELECT a.*,
              o.name    AS organization_name,
              o.acronym AS organization_acronym,
              u.first_name AS author_first_name,
              u.last_name  AS author_last_name
         FROM announcements a
         JOIN organizations o ON o.id = a.organization_id
    LEFT JOIN users u         ON u.id = a.created_by
        WHERE a.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Announcement not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * Dispatches notifications to eligible student users when an announcement is posted.
 */
async function notifyStudentsForAnnouncement(announcement, orgInfo) {
  if (!announcement || !announcement.id) return;
  try {
    const orgId = announcement.organization_id;
    const orgName = orgInfo?.name || orgInfo?.acronym || 'Campus Organization';
    const title = `New Announcement: ${announcement.title}`;
    const previewContent = announcement.content.length > 120
      ? `${announcement.content.slice(0, 120)}...`
      : announcement.content;
    const message = `${orgName}: "${previewContent}"`;

    let studentQuery = `
      SELECT DISTINCT s.user_id
        FROM students s
        JOIN users u ON u.id = s.user_id AND u.status = 'ACTIVE' AND u.role IN ('STUDENT', 'OFFICER')
       WHERE s.id IN (
         SELECT om.student_id
           FROM organization_members om
          WHERE om.organization_id = $1 AND om.status = 'ACTIVE'
       )
    `;
    const params = [orgId];

    if (orgInfo?.scope === 'UNIVERSITY') {
      studentQuery = `
        SELECT DISTINCT s.user_id
          FROM students s
          JOIN users u ON u.id = s.user_id AND u.status = 'ACTIVE' AND u.role IN ('STUDENT', 'OFFICER')
      `;
      params.length = 0;
    } else if (orgInfo?.college_id) {
      studentQuery = `
        SELECT DISTINCT s.user_id
          FROM students s
          JOIN users u ON u.id = s.user_id AND u.status = 'ACTIVE' AND u.role IN ('STUDENT', 'OFFICER')
          JOIN programs p ON p.id = s.program_id
          JOIN departments d ON d.id = p.department_id
         WHERE d.college_id = $1
            OR s.id IN (
              SELECT om.student_id
                FROM organization_members om
               WHERE om.organization_id = $2 AND om.status = 'ACTIVE'
            )
      `;
      params.length = 0;
      params.push(orgInfo.college_id, orgId);
    }

    const studentsRes = await db.query(studentQuery, params);

    // Also notify active Admins and Advisers
    const staffRes = await db.query(
      "SELECT id AS user_id FROM users WHERE role IN ('ADMIN', 'ADVISER') AND status = 'ACTIVE'"
    );

    const recipientUserIds = new Set([
      ...studentsRes.rows.map((r) => r.user_id),
      ...staffRes.rows.map((r) => r.user_id),
    ]);

    for (const userId of recipientUserIds) {
      await db.query(
        `INSERT INTO notifications (user_id, type, title, message, created_at)
         VALUES ($1, 'ANNOUNCEMENT', $2, $3, now())`,
        [userId, title, message]
      );
    }

    // Record publication in audit_logs
    await db.query(
      `INSERT INTO audit_logs (user_id, action, entity, entity_id, metadata, created_at)
       VALUES ($1, 'PUBLISH_ANNOUNCEMENT', 'announcements', $2, $3::jsonb, now())`,
      [
        announcement.created_by || null,
        String(announcement.id),
        JSON.stringify({ title: announcement.title, organization_id: orgId })
      ]
    ).catch(() => null);

  } catch (err) {
    console.error('[ANNOUNCEMENT NOTIFICATION ERROR]', err);
  }
}

// POST /api/announcements — Publish a new announcement for an organization and notify students
router.post('/', async (req, res) => {
  try {
    const { organization_id, title, content, created_by } = req.body;

    if (!organization_id || !title || !content) {
      return res.status(400).json({ error: 'organization_id, title, and content are required' });
    }

    const result = await db.query(
      `INSERT INTO announcements (organization_id, title, content, created_by, published_at)
       VALUES ($1, $2, $3, $4, now())
       RETURNING *`,
      [organization_id, title.trim(), content.trim(), created_by || null]
    );

    const announcementRow = result.rows[0];

    // Fetch organization metadata for student notifications
    const orgRes = await db.query('SELECT name, acronym, scope, college_id FROM organizations WHERE id = $1', [organization_id]);
    const orgInfo = orgRes.rows[0] || null;

    // Dispatch notifications to students
    await notifyStudentsForAnnouncement(announcementRow, orgInfo);

    // Also notify active faculty adviser(s) of the organization
    await notifyAdvisersForOrg(organization_id, {
      type: 'ANNOUNCEMENT',
      title: `New Announcement: ${title.trim()}`,
      message: `An officer posted announcement "${title.trim()}" for ${orgInfo?.name || 'Organization'}.`,
    });

    // Send confirmation to the posting officer
    if (created_by) {
      await notifyUser(created_by, {
        type: 'CONFIRMATION',
        title: `Announcement Published: ${title.trim()}`,
        message: `Your announcement "${title.trim()}" for ${orgInfo?.name || 'your organization'} has been published to members.`,
      });
    }

    // Return announcement with organization and author details
    const fullRow = await db.query(
      `SELECT a.*,
              o.name    AS organization_name,
              o.acronym AS organization_acronym,
              o.logo    AS organization_logo,
              u.first_name AS author_first_name,
              u.last_name  AS author_last_name
         FROM announcements a
         JOIN organizations o ON o.id = a.organization_id
    LEFT JOIN users u         ON u.id = a.created_by
        WHERE a.id = $1`,
      [announcementRow.id]
    );

    res.status(201).json(fullRow.rows[0] || announcementRow);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/announcements/:id — Update an existing announcement's title or content
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content } = req.body;

    const result = await db.query(
      `UPDATE announcements
          SET title = COALESCE($2, title),
              content = COALESCE($3, content)
        WHERE id = $1
        RETURNING *`,
      [id, title ? title.trim() : null, content ? content.trim() : null]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Announcement not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/announcements/:id — Delete an announcement by ID
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('DELETE FROM announcements WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Announcement not found' });
    }
    res.json({ message: 'Announcement deleted successfully', announcement: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

