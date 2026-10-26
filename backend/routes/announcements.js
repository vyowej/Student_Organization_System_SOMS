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
  recordAuditLog,
} = require('../notificationsHelper');

async function resolveUserId(rawUserId) {
  if (!rawUserId || !Number.isFinite(Number(rawUserId))) return null;
  const uid = Number(rawUserId);
  const res = await db.query('SELECT id FROM users WHERE id = $1 LIMIT 1', [uid]);
  return res.rows.length > 0 ? res.rows[0].id : null;
}

const ANNOUNCEMENT_SELECT_QUERY = `
  SELECT a.*,
         o.name    AS organization_name,
         o.acronym AS organization_acronym,
         o.logo    AS organization_logo,
         u.first_name AS author_first_name,
         u.last_name  AS author_last_name,
         u.suffix     AS author_suffix
    FROM announcements a
    JOIN organizations o ON o.id = a.organization_id
    LEFT JOIN users u    ON u.id = COALESCE(a.created_by, a.author_id)
`;

// GET /api/announcements — List announcements across organizations (newest first)
router.get('/', async (req, res) => {
  try {
    const { organization_id, limit } = req.query;
    let queryText = ANNOUNCEMENT_SELECT_QUERY;
    const params = [];

    if (organization_id) {
      queryText += ' WHERE a.organization_id = $1';
      params.push(organization_id);
    }

    queryText += ' ORDER BY COALESCE(a.published_at, a.created_at) DESC';

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
      `${ANNOUNCEMENT_SELECT_QUERY} WHERE a.id = $1`,
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
 * Dispatches notifications to all active student/officer users when an announcement is published.
 */
async function notifyStudentsForAnnouncement(announcement, orgInfo) {
  if (!announcement || !announcement.id) return;
  try {
    const orgId = announcement.organization_id;
    const orgName = orgInfo?.name || announcement.organization_name || orgInfo?.acronym || 'Campus Organization';
    const title = `New Announcement: ${announcement.title}`;
    const previewContent = announcement.content.length > 120
      ? `${announcement.content.slice(0, 120)}...`
      : announcement.content;
    const message = `${orgName}: "${previewContent}"`;

    // Notify all active students & officers across the portal
    const studentsRes = await db.query(`
      SELECT DISTINCT id AS user_id
        FROM users
       WHERE status = 'ACTIVE' AND role IN ('STUDENT', 'OFFICER')
      UNION
      SELECT DISTINCT user_id
        FROM students
       WHERE user_id IS NOT NULL
    `);

    // Also notify active Admins and Advisers
    const staffRes = await db.query(
      "SELECT id AS user_id FROM users WHERE role IN ('ADMIN', 'ADVISER') AND status = 'ACTIVE'"
    );

    const recipientUserIds = new Set([
      ...studentsRes.rows.map((r) => r.user_id).filter(Boolean),
      ...staffRes.rows.map((r) => r.user_id).filter(Boolean),
    ]);

    for (const userId of recipientUserIds) {
      const existing = await db.query(
        'SELECT id FROM notifications WHERE user_id = $1 AND type = $2 AND LOWER(title) = LOWER($3) LIMIT 1',
        [userId, 'ANNOUNCEMENT', title]
      );
      if (existing.rows.length === 0) {
        await db.query(
          `INSERT INTO notifications (user_id, type, title, message, created_at)
           VALUES ($1, 'ANNOUNCEMENT', $2, $3, now())`,
          [userId, title, message]
        );
      }
    }

    // Record publication in audit_logs
    await recordAuditLog({
      userId: announcement.created_by || announcement.author_id || null,
      action: 'PUBLISH_ANNOUNCEMENT',
      entity: 'announcements',
      entityId: announcement.id,
      metadata: {
        title: announcement.title,
        organization_id: orgId,
        description: `Published announcement "${announcement.title}" for ${orgName}`,
      },
    }).catch(() => null);

  } catch (err) {
    console.error('[ANNOUNCEMENT NOTIFICATION ERROR]', err);
  }
}

// POST /api/announcements — Create or publish an announcement for an organization and notify students
router.post('/', async (req, res) => {
  try {
    const { organization_id, title, content, created_by, status, published_at, is_pinned } = req.body;

    if (!organization_id || !title || !content) {
      return res.status(400).json({ error: 'organization_id, title, and content are required' });
    }

    const validUserId = await resolveUserId(created_by);
    const isDraft = status === 'DRAFT' || published_at === null;
    const resolvedStatus = isDraft ? 'DRAFT' : (status || 'PUBLISHED');
    const resolvedPublishedAt = isDraft ? null : (published_at || new Date().toISOString());

    const result = await db.query(
      `INSERT INTO announcements (organization_id, title, content, author_id, created_by, status, is_pinned, published_at)
       VALUES ($1, $2, $3, $4, $4, $5, $6, $7)
       RETURNING *`,
      [
        organization_id,
        title.trim(),
        content.trim(),
        validUserId,
        resolvedStatus,
        Boolean(is_pinned),
        resolvedPublishedAt,
      ]
    );

    const announcementRow = result.rows[0];

    // Fetch organization metadata for student notifications
    const orgRes = await db.query('SELECT name, acronym, scope, college_id FROM organizations WHERE id = $1', [organization_id]);
    const orgInfo = orgRes.rows[0] || null;

    if (!isDraft) {
      // Dispatch notifications to students
      await notifyStudentsForAnnouncement(announcementRow, orgInfo);

      // Also notify active faculty adviser(s) of the organization
      await notifyAdvisersForOrg(organization_id, {
        type: 'ANNOUNCEMENT',
        title: `New Announcement: ${title.trim()}`,
        message: `An officer posted announcement "${title.trim()}" for ${orgInfo?.name || 'Organization'}.`,
      });

      // Send confirmation to the posting officer
      if (validUserId) {
        await notifyUser(validUserId, {
          type: 'CONFIRMATION',
          title: `Announcement Published: ${title.trim()}`,
          message: `Your announcement "${title.trim()}" for ${orgInfo?.name || 'your organization'} has been published to members.`,
        });
      }
    } else {
      // Record draft creation in audit logs
      await recordAuditLog({
        userId: validUserId,
        action: 'CREATE_ANNOUNCEMENT_DRAFT',
        entity: 'announcements',
        entityId: announcementRow.id,
        metadata: {
          title: announcementRow.title,
          organization_id,
          status: 'DRAFT',
          description: `Saved draft announcement "${announcementRow.title}" for ${orgInfo?.name || 'Organization'}`,
        },
        req,
      });
    }

    const fullRow = await db.query(
      `${ANNOUNCEMENT_SELECT_QUERY} WHERE a.id = $1`,
      [announcementRow.id]
    );

    res.status(201).json(fullRow.rows[0] || announcementRow);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/announcements/:id — Update an existing announcement's title, content, status, or pin state
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, status, published_at, is_pinned } = req.body;

    const currentRes = await db.query('SELECT * FROM announcements WHERE id = $1', [id]);
    if (currentRes.rows.length === 0) {
      return res.status(404).json({ error: 'Announcement not found' });
    }
    const current = currentRes.rows[0];

    const nextStatus = status || (published_at === null ? 'DRAFT' : (published_at ? 'PUBLISHED' : current.status || 'PUBLISHED'));
    const nextPublishedAt = nextStatus === 'DRAFT'
      ? null
      : (published_at || current.published_at || new Date().toISOString());
    const nextPinned = is_pinned !== undefined ? Boolean(is_pinned) : Boolean(current.is_pinned);

    const result = await db.query(
      `UPDATE announcements
          SET title = COALESCE($2, title),
              content = COALESCE($3, content),
              status = $4,
              published_at = $5,
              is_pinned = $6
        WHERE id = $1
        RETURNING *`,
      [
        id,
        title ? title.trim() : null,
        content ? content.trim() : null,
        nextStatus,
        nextPublishedAt,
        nextPinned,
      ]
    );

    const updated = result.rows[0];
    const fullRow = await db.query(`${ANNOUNCEMENT_SELECT_QUERY} WHERE a.id = $1`, [id]);
    const fullAnnouncement = fullRow.rows[0] || updated;

    // If transitioning from DRAFT to PUBLISHED, dispatch student notifications
    if (nextStatus === 'PUBLISHED' && (current.status === 'DRAFT' || !current.published_at)) {
      const orgRes = await db.query('SELECT name, acronym, scope, college_id FROM organizations WHERE id = $1', [updated.organization_id]);
      const orgInfo = orgRes.rows[0] || null;
      await notifyStudentsForAnnouncement(fullAnnouncement, orgInfo);
    }

    await recordAuditLog({
      userId: req.body?.user_id || fullAnnouncement.created_by || null,
      action: nextStatus === 'ARCHIVED' ? 'ARCHIVE_ANNOUNCEMENT' : 'UPDATE_ANNOUNCEMENT',
      entity: 'announcements',
      entityId: fullAnnouncement.id,
      metadata: {
        title: fullAnnouncement.title,
        organization_id: fullAnnouncement.organization_id,
        status: nextStatus,
        description: `Updated announcement "${fullAnnouncement.title}"`,
      },
      req,
    });

    res.json(fullAnnouncement);
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

    const deleted = result.rows[0];
    await recordAuditLog({
      userId: req.body?.user_id || req.query?.user_id || null,
      action: 'DELETE_ANNOUNCEMENT',
      entity: 'announcements',
      entityId: id,
      metadata: {
        title: deleted.title,
        organization_id: deleted.organization_id,
        description: `Deleted announcement "${deleted.title}"`,
      },
      req,
    });

    res.json({ message: 'Announcement deleted successfully', announcement: deleted });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
