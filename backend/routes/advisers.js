/**
 * Organization Advisers & Change Requests Routes (backend/routes/advisers.js)
 *
 * Links to `advisers`, `organization_advisers`, and `adviser_change_requests`
 * tables in ../database/student_org_db.sql.
 */
const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/advisers — List all faculty advisers with user, college, and active organization assignments
router.get('/', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT a.id,
             a.user_id,
             a.employee_number,
             a.college_id,
             u.email,
             u.first_name,
             u.last_name,
             (u.last_name || ', ' || u.first_name) AS name,
             c.name AS college_name,
             c.acronym AS college_acronym,
             COALESCE(
               (SELECT json_agg(json_build_object(
                 'organization_id', oa.organization_id,
                 'organization_name', o.name,
                 'organization_acronym', o.acronym,
                 'assigned_at', oa.assigned_at
               ))
                FROM organization_advisers oa
                JOIN organizations o ON o.id = oa.organization_id
               WHERE oa.adviser_id = a.id AND oa.ended_at IS NULL),
               '[]'::json
             ) AS active_organizations
        FROM advisers a
        JOIN users u ON u.id = a.user_id
   LEFT JOIN colleges c ON c.id = a.college_id
       ORDER BY u.last_name ASC, u.first_name ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/advisers/assignments — List all current and historical organization_advisers records
router.get('/assignments', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT oa.*,
             (oa.ended_at IS NULL) AS is_current,
             o.name AS organization_name,
             o.acronym AS organization_acronym,
             a.employee_number,
             u.id AS adviser_user_id,
             u.first_name,
             u.last_name,
             (u.last_name || ', ' || u.first_name) AS adviser_name,
             u.email,
             c.name AS college_name,
             assigner.first_name AS assigner_first_name,
             assigner.last_name  AS assigner_last_name
        FROM organization_advisers oa
        JOIN organizations o ON o.id = oa.organization_id
        JOIN advisers a      ON a.id = oa.adviser_id
        JOIN users u         ON u.id = a.user_id
   LEFT JOIN colleges c      ON c.id = a.college_id
   LEFT JOIN users assigner  ON assigner.id = oa.assigned_by
       ORDER BY oa.assigned_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/advisers/org/:organization_id — Fetch current and past advisers for an organization
router.get('/org/:organization_id', async (req, res) => {
  try {
    const { organization_id } = req.params;
    const result = await db.query(
      `SELECT oa.id,
              oa.organization_id,
              oa.adviser_id,
              oa.assigned_at,
              oa.ended_at,
              (oa.ended_at IS NULL) AS is_current,
              a.employee_number,
              u.first_name,
              u.last_name,
              (u.last_name || ', ' || u.first_name) AS adviser_name,
              u.email,
              c.name AS college_name,
              assigner.first_name AS assigner_first_name,
              assigner.last_name  AS assigner_last_name
         FROM organization_advisers oa
         JOIN advisers a       ON a.id = oa.adviser_id
         JOIN users u          ON u.id = a.user_id
    LEFT JOIN colleges c       ON c.id = a.college_id
    LEFT JOIN users assigner   ON assigner.id = oa.assigned_by
        WHERE oa.organization_id = $1
        ORDER BY oa.assigned_at DESC`,
      [organization_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/advisers/assign — End any current adviser assignment (uq_one_current_adviser) and assign a new one
router.post('/assign', async (req, res) => {
  try {
    const { organization_id, adviser_id, assigned_by } = req.body;

    if (!organization_id || !adviser_id) {
      return res.status(400).json({ error: 'organization_id and adviser_id are required' });
    }

    // Close existing active adviser assignment so uq_one_current_adviser is satisfied
    await db.query(
      `UPDATE organization_advisers
          SET ended_at = now()
        WHERE organization_id = $1 AND ended_at IS NULL`,
      [organization_id]
    );

    const result = await db.query(
      `INSERT INTO organization_advisers (organization_id, adviser_id, assigned_by, assigned_at)
       VALUES ($1, $2, $3, now())
       RETURNING *`,
      [organization_id, adviser_id, assigned_by || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/advisers/requests — List adviser change requests with optional status and organization filters
router.get('/requests', async (req, res) => {
  try {
    const { status, organization_id } = req.query;
    let queryText = `
      SELECT acr.*,
             o.name AS organization_name,
             o.acronym AS organization_acronym,
             cu.first_name AS current_adviser_first_name,
             cu.last_name  AS current_adviser_last_name,
             CASE WHEN cu.id IS NOT NULL THEN (cu.last_name || ', ' || cu.first_name) ELSE NULL END AS current_adviser_name,
             pu.first_name AS proposed_adviser_first_name,
             pu.last_name  AS proposed_adviser_last_name,
             CASE WHEN pu.id IS NOT NULL THEN (pu.last_name || ', ' || pu.first_name) ELSE NULL END AS proposed_adviser_name,
             req_user.first_name AS requester_first_name,
             req_user.last_name  AS requester_last_name,
             CASE WHEN req_user.id IS NOT NULL THEN (req_user.last_name || ', ' || req_user.first_name) ELSE NULL END AS requester_name,
             rev_user.first_name AS reviewer_first_name,
             rev_user.last_name  AS reviewer_last_name
        FROM adviser_change_requests acr
        JOIN organizations o ON o.id = acr.organization_id
   LEFT JOIN advisers ca     ON ca.id = acr.current_adviser_id
   LEFT JOIN users cu        ON cu.id = ca.user_id
   LEFT JOIN advisers pa     ON pa.id = acr.proposed_adviser_id
   LEFT JOIN users pu        ON pu.id = pa.user_id
   LEFT JOIN users req_user  ON req_user.id = acr.requested_by
   LEFT JOIN users rev_user  ON rev_user.id = acr.reviewed_by
       WHERE 1=1
    `;
    const params = [];

    if (status) {
      params.push(status);
      queryText += ` AND acr.status = $${params.length}`;
    }
    if (organization_id) {
      params.push(organization_id);
      queryText += ` AND acr.organization_id = $${params.length}`;
    }

    queryText += ' ORDER BY acr.created_at DESC';

    const result = await db.query(queryText, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/advisers/requests — Submit a new adviser change request (uq_one_pending_change_request)
router.post('/requests', async (req, res) => {
  try {
    const { organization_id, proposed_adviser_id, requested_by, reason } = req.body;

    if (!organization_id || !proposed_adviser_id || !reason) {
      return res.status(400).json({
        error: 'organization_id, proposed_adviser_id, and reason are required',
      });
    }

    // Look up the active adviser for the organization to populate current_adviser_id
    const currentAdvRes = await db.query(
      'SELECT adviser_id FROM organization_advisers WHERE organization_id = $1 AND ended_at IS NULL',
      [organization_id]
    );
    const currentAdviserId = currentAdvRes.rows.length > 0 ? currentAdvRes.rows[0].adviser_id : null;

    // Enforce CHECK (current_adviser_id IS DISTINCT FROM proposed_adviser_id)
    if (currentAdviserId !== null && Number(currentAdviserId) === Number(proposed_adviser_id)) {
      return res.status(400).json({ error: 'Proposed adviser is already the current adviser' });
    }

    const result = await db.query(
      `INSERT INTO adviser_change_requests (
        organization_id, current_adviser_id, proposed_adviser_id, requested_by, reason, status
      ) VALUES ($1, $2, $3, $4, $5, 'PENDING')
      RETURNING *`,
      [organization_id, currentAdviserId, proposed_adviser_id, requested_by || null, reason.trim()]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A pending adviser change request already exists for this organization' });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/advisers/requests/:id/review — Approve, reject, or cancel a pending adviser change request
router.put('/requests/:id/review', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reviewed_by, review_remarks } = req.body;

    const normalizedStatus = String(status || '').toUpperCase();
    if (!['APPROVED', 'REJECTED', 'CANCELLED'].includes(normalizedStatus)) {
      return res.status(400).json({ error: "status must be 'APPROVED', 'REJECTED', or 'CANCELLED'" });
    }

    const reqResult = await db.query(
      `UPDATE adviser_change_requests
          SET status = $2,
              reviewed_by = $3,
              review_remarks = $4,
              reviewed_at = now()
        WHERE id = $1 AND status = 'PENDING'
        RETURNING *`,
      [id, normalizedStatus, reviewed_by || null, review_remarks || null]
    );

    if (reqResult.rows.length === 0) {
      return res.status(404).json({ error: 'Request not found or already reviewed' });
    }

    const changeRequest = reqResult.rows[0];

    // When approved, automatically transition the organization's active adviser
    if (normalizedStatus === 'APPROVED' && changeRequest.proposed_adviser_id) {
      await db.query(
        `UPDATE organization_advisers
            SET ended_at = now()
          WHERE organization_id = $1 AND ended_at IS NULL`,
        [changeRequest.organization_id]
      );

      await db.query(
        `INSERT INTO organization_advisers (organization_id, adviser_id, assigned_by, assigned_at)
         VALUES ($1, $2, $3, now())`,
        [changeRequest.organization_id, changeRequest.proposed_adviser_id, reviewed_by || null]
      );
    }

    res.json({ message: `Request ${normalizedStatus.toLowerCase()} successfully`, request: changeRequest });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
