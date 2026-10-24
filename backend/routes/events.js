/**
 * Organization Events Routes (backend/routes/events.js)
 *
 * Links to the `events` table (`event_status` ENUM) in
 * ../database/student_org_db.sql.
 */
const express = require('express');
const router = express.Router();
const db = require('../db');

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
      start_date,
      end_date,
      max_participants,
      created_by,
      status,
    } = req.body;

    if (!organization_id || !title || !start_date) {
      return res.status(400).json({
        error: 'organization_id, title, and start_date are required',
      });
    }

    const startDateVal = new Date(start_date);
    let endDateVal = end_date ? new Date(end_date) : new Date(startDateVal.getTime() + 2 * 60 * 60 * 1000);
    // Matches CHECK (end_date >= start_date) in database/student_org_db.sql
    if (endDateVal < startDateVal) {
      endDateVal = new Date(startDateVal.getTime() + 60 * 60 * 1000);
    }

    const eventStatus = normalizeEventStatus(status);
    const maxPartVal = max_participants && Number(max_participants) > 0 ? Number(max_participants) : null;

    const insertRes = await db.query(
      `INSERT INTO events (
        organization_id, title, description, location,
        start_date, end_date, max_participants, created_by, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id`,
      [
        organization_id,
        title.trim(),
        description || null,
        location ? location.trim() : null,
        startDateVal.toISOString(),
        endDateVal.toISOString(),
        maxPartVal,
        created_by || null,
        eventStatus,
      ]
    );

    const fullEvent = await db.query(`${EVENT_SELECT_QUERY} WHERE e.id = $1`, [insertRes.rows[0].id]);
    res.status(201).json(fullEvent.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

// PUT /api/events/:id/publish — Transition an event status to PUBLISHED
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
    res.json(fullEvent.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
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
      start_date,
      end_date,
      max_participants,
      status,
      approved_by,
      approved_at,
    } = req.body;

    const existingRes = await db.query('SELECT * FROM events WHERE id = $1', [id]);
    if (existingRes.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }
    const current = existingRes.rows[0];

    const nextStart = start_date ? new Date(start_date) : new Date(current.start_date);
    let nextEnd = end_date ? new Date(end_date) : new Date(current.end_date);
    if (nextEnd < nextStart) {
      nextEnd = new Date(nextStart.getTime() + 60 * 60 * 1000);
    }

    const nextStatus = status ? normalizeEventStatus(status) : current.status;
    const nextMaxPart = max_participants !== undefined
      ? (max_participants && Number(max_participants) > 0 ? Number(max_participants) : null)
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
              status = $8,
              approved_by = $9,
              approved_at = $10
        WHERE id = $1`,
      [
        id,
        title ? title.trim() : current.title,
        description !== undefined ? description : current.description,
        location !== undefined ? (location ? location.trim() : null) : current.location,
        nextStart.toISOString(),
        nextEnd.toISOString(),
        nextMaxPart,
        nextStatus,
        nextApprovedBy,
        nextApprovedAt,
      ]
    );

    const fullEvent = await db.query(`${EVENT_SELECT_QUERY} WHERE e.id = $1`, [id]);
    res.json(fullEvent.rows[0]);
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
