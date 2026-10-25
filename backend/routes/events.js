/**
 * Organization Events Routes (backend/routes/events.js)
 *
 * Links to the `events` table (`event_status` ENUM) in
 * ../database/student_org_db.sql.
 */
const express = require('express');
const router = express.Router();
const db = require('../db');
const {
  notifyUser,
  notifyAdvisersForOrg,
  notifyAdmins,
  recordAuditLog,
} = require('../notificationsHelper');

const VALID_EVENT_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'APPROVED',
  'PUBLISHED',
  'COMPLETED',
  'CANCELLED',
];

function normalizeEventStatus(input) {
  if (!input) return 'DRAFT';
  const upper = String(input).trim().toUpperCase();
  if (VALID_EVENT_STATUSES.includes(upper)) return upper;
  if (upper === 'UNDER_REVIEW' || upper === 'PENDING') return 'SUBMITTED';
  if (upper === 'ONGOING') return 'PUBLISHED';
  if (upper === 'ARCHIVED') return 'COMPLETED';
  if (upper === 'RETURNED' || upper === 'RETURNED_FOR_REVISION') return 'DRAFT';
  if (upper === 'REJECTED') return 'CANCELLED';
  return 'DRAFT';
}

const EVENT_SELECT_QUERY = `
  SELECT e.*,
         o.name AS organization_name,
         o.acronym AS organization_acronym,
         o.org_type AS organization_type,
         o.scope AS organization_scope,
         o.college_id AS organization_college_id,
         CASE WHEN cu.id IS NOT NULL THEN (cu.last_name || ', ' || cu.first_name) ELSE NULL END AS created_by_name,
         CASE WHEN au.id IS NOT NULL THEN (au.last_name || ', ' || au.first_name) ELSE NULL END AS approved_by_name,
         au.role AS approved_by_role,
         (SELECT COUNT(*)::int FROM event_registrations er WHERE er.event_id = e.id AND er.status != 'CANCELLED') AS registered_count,
         (SELECT COUNT(*)::int FROM attendance att WHERE att.event_id = e.id) AS attended_count
    FROM events e
    JOIN organizations o ON o.id = e.organization_id
    LEFT JOIN users cu ON cu.id = e.created_by
    LEFT JOIN users au ON au.id = e.approved_by
`;

/**
 * Dispatches notifications to eligible student users when an event is published.
 */
async function notifyStudentsForEvent(event) {
  if (!event || !event.id) return;
  try {
    const orgId = event.organization_id;
    const orgName = event.organization_name || event.organization_acronym || 'Student Organization';
    const eventTitle = event.title;
    const startDate = event.start_date
      ? new Date(event.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : 'Upcoming';

    let targetStudentsQuery = `
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

    if (event.organization_scope === 'UNIVERSITY') {
      targetStudentsQuery = `
        SELECT DISTINCT s.user_id
          FROM students s
          JOIN users u ON u.id = s.user_id AND u.status = 'ACTIVE' AND u.role IN ('STUDENT', 'OFFICER')
      `;
      params.length = 0;
    } else if (event.organization_college_id) {
      targetStudentsQuery = `
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
      params.push(event.organization_college_id, orgId);
    }

    const studentsRes = await db.query(targetStudentsQuery, params);

    // Also notify active Admins and Advisers
    const staffRes = await db.query(
      "SELECT id AS user_id FROM users WHERE role IN ('ADMIN', 'ADVISER') AND status = 'ACTIVE'"
    );

    const recipientUserIds = new Set([
      ...studentsRes.rows.map((r) => r.user_id),
      ...staffRes.rows.map((r) => r.user_id),
    ]);

    const title = `New Event: ${eventTitle}`;
    const message = `${orgName} published a new event: "${eventTitle}" on ${startDate}. Registration is now open!`;

    for (const userId of recipientUserIds) {
      await db.query(
        `INSERT INTO notifications (user_id, type, title, message, created_at)
         VALUES ($1, 'EVENT', $2, $3, now())`,
        [userId, title, message]
      );
    }

    // Record publication in audit_logs
    await db.query(
      `INSERT INTO audit_logs (user_id, action, entity, entity_id, metadata, created_at)
       VALUES ($1, 'PUBLISH_EVENT', 'events', $2, $3::jsonb, now())`,
      [
        event.approved_by || event.created_by || null,
        String(event.id),
        JSON.stringify({ title: eventTitle, organization_id: orgId })
      ]
    ).catch(() => null);

  } catch (err) {
    console.error('[EVENT NOTIFICATION ERROR]', err);
  }
}

// GET /api/events — Retrieve events joined with organization details and attendance/registration counts
router.get('/', async (req, res) => {
  try {
    const { organization_id, status, all } = req.query;
    let queryText = `${EVENT_SELECT_QUERY} WHERE 1=1`;
    const params = [];

    if (organization_id) {
      params.push(organization_id);
      queryText += ` AND e.organization_id = $${params.length}`;
    }

    if (all !== 'true' && status !== 'ALL') {
      const filterStatus = status ? normalizeEventStatus(status) : (organization_id ? null : 'PUBLISHED');
      if (filterStatus) {
        params.push(filterStatus);
        queryText += ` AND e.status = $${params.length}`;
      }
    }

    queryText += ' ORDER BY e.start_date ASC';

    const result = await db.query(queryText, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/events/:id — Retrieve a single event by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(`${EVENT_SELECT_QUERY} WHERE e.id = $1`, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/events — Create or propose a new organization event
router.post('/', async (req, res) => {
  try {
    const {
      organization_id,
      title,
      description,
      location,
      venue,
      start_date,
      start_datetime,
      end_date,
      end_datetime,
      max_participants,
      capacity,
      created_by,
      user_id,
      status,
    } = req.body;

    const resolvedTitle = title ? title.trim() : '';
    const resolvedStartDate = start_date || start_datetime;
    const resolvedEndDate = end_date || end_datetime;
    const resolvedLocation = location || venue || 'WMSU Campus';
    const resolvedMaxParticipants = max_participants !== undefined ? max_participants : capacity;
    const resolvedCreatedBy = created_by || user_id || null;

    if (!organization_id || !resolvedTitle || !resolvedStartDate) {
      return res.status(400).json({
        error: 'organization_id, title, and start_date are required',
      });
    }

    const startDateVal = new Date(resolvedStartDate);
    let endDateVal = resolvedEndDate ? new Date(resolvedEndDate) : new Date(startDateVal.getTime() + 2 * 60 * 60 * 1000);
    // Matches CHECK (end_date >= start_date) in database/student_org_db.sql
    if (endDateVal < startDateVal) {
      endDateVal = new Date(startDateVal.getTime() + 60 * 60 * 1000);
    }

    const eventStatus = normalizeEventStatus(status);
    const maxPartVal = resolvedMaxParticipants && Number(resolvedMaxParticipants) > 0 ? Number(resolvedMaxParticipants) : null;

    const insertRes = await db.query(
      `INSERT INTO events (
        organization_id, title, description, location,
        start_date, end_date, max_participants, created_by, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id`,
      [
        organization_id,
        resolvedTitle,
        description || null,
        resolvedLocation ? resolvedLocation.trim() : null,
        startDateVal.toISOString(),
        endDateVal.toISOString(),
        maxPartVal,
        resolvedCreatedBy,
        eventStatus,
      ]
    );

    const fullEvent = await db.query(`${EVENT_SELECT_QUERY} WHERE e.id = $1`, [insertRes.rows[0].id]);
    const eventRow = fullEvent.rows[0];
    const orgDisplayName = eventRow.organization_name || eventRow.organization_acronym || 'Student Organization';

    // If created immediately with PUBLISHED status, notify eligible students & advisers
    if (eventStatus === 'PUBLISHED') {
      await notifyStudentsForEvent(eventRow);
      await notifyAdvisersForOrg(organization_id, {
        type: 'EVENT',
        title: `New Event Published: ${resolvedTitle}`,
        message: `An event "${resolvedTitle}" has been scheduled and published for ${orgDisplayName}.`,
      });
      if (resolvedCreatedBy) {
        await notifyUser(resolvedCreatedBy, {
          type: 'CONFIRMATION',
          title: `Event Published: ${resolvedTitle}`,
          message: `Your event "${resolvedTitle}" has been published and is now open for student registrations.`,
        });
      }
      await recordAuditLog({
        userId: resolvedCreatedBy,
        action: 'PUBLISH_EVENT',
        entity: 'events',
        entityId: eventRow.id,
        metadata: { title: resolvedTitle, organization_id },
      });
    } else if (eventStatus === 'SUBMITTED') {
      // 1. Notify assigned adviser(s) that an officer submitted an event proposal
      await notifyAdvisersForOrg(organization_id, {
        type: 'APPROVAL',
        title: `Event Proposal Submitted: ${resolvedTitle}`,
        message: `An officer from ${orgDisplayName} submitted event proposal "${resolvedTitle}" for your review and endorsement.`,
      });

      // 2. Dispatch submission confirmation to the submitting officer
      if (resolvedCreatedBy) {
        await notifyUser(resolvedCreatedBy, {
          type: 'CONFIRMATION',
          title: `Submission Confirmed: ${resolvedTitle}`,
          message: `Your event proposal "${resolvedTitle}" for ${orgDisplayName} has been submitted successfully and is queued for faculty adviser review.`,
        });
      }

      // 3. Record audit log
      await recordAuditLog({
        userId: resolvedCreatedBy,
        action: 'SUBMIT_EVENT_PROPOSAL',
        entity: 'events',
        entityId: eventRow.id,
        metadata: { title: resolvedTitle, organization_id, status: eventStatus },
      });
    }

    res.status(201).json(eventRow);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

// PUT /api/events/:id/publish — Transition an event status to PUBLISHED and notify students
router.put('/:id/publish', async (req, res) => {
  try {
    const { id } = req.params;
    const { approved_by } = req.body || {};
    const result = await db.query(
      `UPDATE events
          SET status = 'PUBLISHED',
              approved_by = COALESCE($2, approved_by),
              approved_at = COALESCE(approved_at, now())
        WHERE id = $1
        RETURNING id`,
      [id, approved_by || null]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const fullEvent = await db.query(`${EVENT_SELECT_QUERY} WHERE e.id = $1`, [id]);
    const eventRow = fullEvent.rows[0];

    // Dispatch notifications to students
    await notifyStudentsForEvent(eventRow);

    // Notify creating officer
    if (eventRow.created_by) {
      await notifyUser(eventRow.created_by, {
        type: 'EVENT',
        title: `Event Approved & Published: ${eventRow.title}`,
        message: `Your event proposal "${eventRow.title}" has been approved and published. Student registrations are open!`,
      });
    }

    // Notify assigned faculty adviser
    await notifyAdvisersForOrg(eventRow.organization_id, {
      type: 'EVENT',
      title: `Event Published: ${eventRow.title}`,
      message: `Event "${eventRow.title}" for ${eventRow.organization_name || 'Organization'} is now officially published.`,
    });

    await recordAuditLog({
      userId: approved_by || null,
      action: 'PUBLISH_EVENT',
      entity: 'events',
      entityId: eventRow.id,
      metadata: { title: eventRow.title, organization_id: eventRow.organization_id },
    });

    res.json(eventRow);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/events/:id/status — Transition event status (APPROVED, PUBLISHED, REJECTED, CANCELLED)
router.put('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, approved_by, is_published, review_remarks } = req.body || {};

    let targetStatus = status ? normalizeEventStatus(status) : 'APPROVED';
    if (is_published || status === 'PUBLISHED') {
      targetStatus = 'PUBLISHED';
    }

    const existingRes = await db.query('SELECT * FROM events WHERE id = $1', [id]);
    if (existingRes.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }
    const current = existingRes.rows[0];

    await db.query(
      `UPDATE events
          SET status = $2::event_status,
              approved_by = COALESCE($3, approved_by),
              approved_at = CASE WHEN $2::text IN ('APPROVED', 'PUBLISHED') THEN COALESCE(approved_at, now()) ELSE approved_at END
        WHERE id = $1`,
      [id, targetStatus, approved_by || null]
    );

    const fullEvent = await db.query(`${EVENT_SELECT_QUERY} WHERE e.id = $1`, [id]);
    const eventRow = fullEvent.rows[0];
    const orgDisplayName = eventRow.organization_name || eventRow.organization_acronym || 'Organization';

    // If transitioned to PUBLISHED and wasn't already PUBLISHED, notify students, officer, adviser
    if (targetStatus === 'PUBLISHED' && current.status !== 'PUBLISHED') {
      await notifyStudentsForEvent(eventRow);
      if (eventRow.created_by) {
        await notifyUser(eventRow.created_by, {
          type: 'EVENT',
          title: `Event Approved & Published: ${eventRow.title}`,
          message: `Your event proposal "${eventRow.title}" has been approved and published!`,
        });
      }
      await notifyAdvisersForOrg(eventRow.organization_id, {
        type: 'EVENT',
        title: `Event Published: ${eventRow.title}`,
        message: `Event "${eventRow.title}" for ${orgDisplayName} is now published on the portal.`,
      });
      await recordAuditLog({
        userId: approved_by || null,
        action: 'PUBLISH_EVENT',
        entity: 'events',
        entityId: eventRow.id,
        metadata: { title: eventRow.title, organization_id: eventRow.organization_id },
      });
    } else if (targetStatus === 'APPROVED' && current.status !== 'APPROVED') {
      // 1. Notify officer that adviser endorsed the event proposal
      if (eventRow.created_by) {
        await notifyUser(eventRow.created_by, {
          type: 'EVENT_REVIEW',
          title: `Event Proposal Endorsed: ${eventRow.title}`,
          message: `Faculty adviser approved/endorsed your event "${eventRow.title}". It has been submitted for administration review.`,
        });
      }
      // 2. Notify admins that event is endorsed and awaiting admin action
      await notifyAdmins({
        type: 'APPROVAL',
        title: `Event Proposal Endorsed: ${eventRow.title}`,
        message: `Faculty adviser endorsed event proposal "${eventRow.title}" for ${orgDisplayName}. Awaiting admin review.`,
      });
      await recordAuditLog({
        userId: approved_by || null,
        action: 'ENDORSE_EVENT',
        entity: 'events',
        entityId: eventRow.id,
        metadata: { title: eventRow.title, organization_id: eventRow.organization_id },
      });
    } else if ((targetStatus === 'CANCELLED' || targetStatus === 'DRAFT') && current.status !== targetStatus) {
      // Event returned or rejected
      if (eventRow.created_by) {
        await notifyUser(eventRow.created_by, {
          type: 'EVENT_REVIEW',
          title: `Event Proposal Returned: ${eventRow.title}`,
          message: `Your event proposal "${eventRow.title}" was returned by the faculty adviser for revisions.${review_remarks ? ` Remarks: ${review_remarks}` : ''}`,
        });
      }
      await recordAuditLog({
        userId: approved_by || null,
        action: 'RETURN_EVENT',
        entity: 'events',
        entityId: eventRow.id,
        metadata: { title: eventRow.title, organization_id: eventRow.organization_id, status: targetStatus, remarks: review_remarks },
      });
    }

    res.json(eventRow);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

// PUT /api/events/:id — Update event information, approval metadata, or status
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      location,
      venue,
      start_date,
      start_datetime,
      end_date,
      end_datetime,
      max_participants,
      capacity,
      status,
      approved_by,
      approved_at,
    } = req.body;

    const existingRes = await db.query('SELECT * FROM events WHERE id = $1', [id]);
    if (existingRes.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }
    const current = existingRes.rows[0];

    const inputStart = start_date || start_datetime;
    const inputEnd = end_date || end_datetime;
    const inputLoc = location !== undefined ? location : venue;
    const inputMax = max_participants !== undefined ? max_participants : capacity;

    const nextStart = inputStart ? new Date(inputStart) : new Date(current.start_date);
    let nextEnd = inputEnd ? new Date(inputEnd) : new Date(current.end_date);
    if (nextEnd < nextStart) {
      nextEnd = new Date(nextStart.getTime() + 60 * 60 * 1000);
    }

    const nextStatus = status ? normalizeEventStatus(status) : current.status;
    const nextMaxPart = inputMax !== undefined
      ? (inputMax && Number(inputMax) > 0 ? Number(inputMax) : null)
      : current.max_participants;

    const nextApprovedBy = approved_by !== undefined ? approved_by : current.approved_by;
    const nextApprovedAt = approved_at !== undefined
      ? approved_at
      : (['APPROVED', 'PUBLISHED'].includes(nextStatus) && !current.approved_at ? new Date().toISOString() : current.approved_at);

    await db.query(
      `UPDATE events
          SET title = $2,
              description = $3,
              location = $4,
              start_date = $5,
              end_date = $6,
              max_participants = $7,
              status = $8::event_status,
              approved_by = $9,
              approved_at = $10
        WHERE id = $1`,
      [
        id,
        title ? title.trim() : current.title,
        description !== undefined ? description : current.description,
        inputLoc !== undefined ? (inputLoc ? inputLoc.trim() : null) : current.location,
        nextStart.toISOString(),
        nextEnd.toISOString(),
        nextMaxPart,
        nextStatus,
        nextApprovedBy,
        nextApprovedAt,
      ]
    );

    const fullEvent = await db.query(`${EVENT_SELECT_QUERY} WHERE e.id = $1`, [id]);
    const eventRow = fullEvent.rows[0];

    // If transitioned to PUBLISHED, notify students, officer, adviser
    if (nextStatus === 'PUBLISHED' && current.status !== 'PUBLISHED') {
      await notifyStudentsForEvent(eventRow);
      if (eventRow.created_by) {
        await notifyUser(eventRow.created_by, {
          type: 'EVENT',
          title: `Event Approved & Published: ${eventRow.title}`,
          message: `Your event proposal "${eventRow.title}" has been published.`,
        });
      }
      await notifyAdvisersForOrg(eventRow.organization_id, {
        type: 'EVENT',
        title: `Event Published: ${eventRow.title}`,
        message: `Event "${eventRow.title}" for ${eventRow.organization_name || 'Organization'} is now published.`,
      });
    } else if (nextStatus === 'SUBMITTED' && current.status !== 'SUBMITTED') {
      // Re-submitted proposal
      await notifyAdvisersForOrg(eventRow.organization_id, {
        type: 'APPROVAL',
        title: `Event Proposal Submitted: ${eventRow.title}`,
        message: `An updated event proposal "${eventRow.title}" for ${eventRow.organization_name || 'Organization'} was submitted for review.`,
      });
      if (eventRow.created_by) {
        await notifyUser(eventRow.created_by, {
          type: 'CONFIRMATION',
          title: `Submission Confirmed: ${eventRow.title}`,
          message: `Your updated event proposal "${eventRow.title}" was submitted for faculty adviser review.`,
        });
      }
    }

    res.json(eventRow);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

// DELETE /api/events/:id — Delete an event
router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM events WHERE id = $1', [req.params.id]);
    res.json({ deleted: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
