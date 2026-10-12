const express = require('express');
const router = express.Router();
const db = require('../db');

// ============================================================
// MEMBERSHIP ROUTES
// ============================================================

// DATA RELATED: Get all active members and officers of an organization
router.get('/org/:organization_id', async (req, res) => {
  try {
    const { organization_id } = req.params;
    const result = await db.query(
      `SELECT om.id,
              om.organization_id,
              om.student_id,
              om.position,
              om.custom_title,
              om.status,
              om.joined_at,
              om.left_at,
              s.student_number,
              s.year_level,
              u.first_name,
              u.last_name,
              u.email,
              p.name AS program_name,
              p.acronym AS program_acronym
         FROM organization_members om
         JOIN students s ON s.id = om.student_id
         JOIN users u ON u.id = s.user_id
         JOIN programs p ON p.id = s.program_id
        WHERE om.organization_id = $1 AND om.status = 'ACTIVE'
        ORDER BY
          CASE om.position
            WHEN 'PRESIDENT' THEN 1
            WHEN 'VICE_PRESIDENT' THEN 2
            WHEN 'SECRETARY' THEN 3
            WHEN 'TREASURER' THEN 4
            WHEN 'AUDITOR' THEN 5
            WHEN 'PRO' THEN 6
            WHEN 'OTHER_OFFICER' THEN 7
            ELSE 8
          END,
          u.last_name ASC`,
      [organization_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DATA RELATED: Get all organizations that a student is a member of
router.get('/student/:student_id', async (req, res) => {
  try {
    const { student_id } = req.params;
    const result = await db.query(
      `SELECT om.id,
              om.organization_id,
              om.position,
              om.custom_title,
              om.status,
              om.joined_at,
              o.name AS organization_name,
              o.acronym AS organization_acronym,
              o.logo,
              o.scope,
              o.org_type
         FROM organization_members om
         JOIN organizations o ON o.id = om.organization_id
        WHERE om.student_id = $1 AND om.status = 'ACTIVE'
        ORDER BY om.joined_at DESC`,
      [student_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ADMIN/OFFICER: Add a student directly to an organization
router.post('/', async (req, res) => {
  try {
    const { organization_id, student_id, position, custom_title } = req.body;

    if (!organization_id || !student_id) {
      return res.status(400).json({ error: 'organization_id and student_id are required' });
    }

    const memberPosition = position || 'MEMBER';

    const result = await db.query(
      `INSERT INTO organization_members (organization_id, student_id, position, custom_title, status)
       VALUES ($1, $2, $3, $4, 'ACTIVE')
       RETURNING *`,
      [organization_id, student_id, memberPosition, custom_title || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    if (err.message && err.message.includes('Student is not eligible')) {
      return res.status(403).json({ error: err.message });
    }
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Student is already a member of this organization' });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

// ADMIN/OFFICER: Update member position or custom title
router.put('/:id/position', async (req, res) => {
  try {
    const { id } = req.params;
    const { position, custom_title, status } = req.body;

    const result = await db.query(
      `UPDATE organization_members
          SET position = COALESCE($2, position),
              custom_title = COALESCE($3, custom_title),
              status = COALESCE($4, status)
        WHERE id = $1
        RETURNING *`,
      [id, position, custom_title, status]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Membership record not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// MEMBER/OFFICER: Leave or deactivate membership
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      `UPDATE organization_members
          SET status = 'INACTIVE', left_at = now()
        WHERE id = $1
        RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Membership record not found' });
    }
    res.json({ message: 'Membership ended successfully', member: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================================
// APPLICATION ROUTES
// ============================================================

// OFFICER: Get pending applications for an organization
router.get('/applications/org/:organization_id', async (req, res) => {
  try {
    const { organization_id } = req.params;
    const result = await db.query(
      `SELECT oa.id,
              oa.organization_id,
              oa.applicant_id,
              oa.message,
              oa.status,
              oa.created_at,
              s.student_number,
              s.year_level,
              u.first_name,
              u.last_name,
              u.email,
              p.name AS program_name
         FROM organization_applications oa
         JOIN students s ON s.id = oa.applicant_id
         JOIN users u ON u.id = s.user_id
         JOIN programs p ON p.id = s.program_id
        WHERE oa.organization_id = $1
        ORDER BY oa.created_at DESC`,
      [organization_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// STUDENT: Submit application to join an organization
router.post('/applications', async (req, res) => {
  try {
    const { organization_id, applicant_id, message } = req.body;

    if (!organization_id || !applicant_id) {
      return res.status(400).json({ error: 'organization_id and applicant_id are required' });
    }

    const result = await db.query(
      `INSERT INTO organization_applications (organization_id, applicant_id, message, status)
       VALUES ($1, $2, $3, 'PENDING')
       RETURNING *`,
      [organization_id, applicant_id, message || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    // student_can_join eligibility trigger raises exception if not eligible
    if (err.message && err.message.includes('Student is not eligible')) {
      return res.status(403).json({ error: err.message });
    }
    if (err.code === '23505') {
      return res.status(409).json({ error: 'You already have a pending application for this organization' });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

// OFFICER/ADMIN: Review (Approve or Reject) an application
router.put('/applications/:id/review', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reviewed_by, review_remarks } = req.body;

    if (!['APPROVED', 'REJECTED'].includes(status)) {
      return res.status(400).json({ error: "status must be 'APPROVED' or 'REJECTED'" });
    }

    const appResult = await db.query(
      `UPDATE organization_applications
          SET status = $2,
              reviewed_by = $3,
              review_remarks = $4,
              reviewed_at = now()
        WHERE id = $1 AND status = 'PENDING'
        RETURNING *`,
      [id, status, reviewed_by || null, review_remarks || null]
    );

    if (appResult.rows.length === 0) {
      return res.status(404).json({ error: 'Application not found or already reviewed' });
    }

    const app = appResult.rows[0];

    // If approved, automatically add applicant as organization member
    if (status === 'APPROVED') {
      await db.query(
        `INSERT INTO organization_members (organization_id, student_id, position, status)
         VALUES ($1, $2, 'MEMBER', 'ACTIVE')
         ON CONFLICT (organization_id, student_id)
         DO UPDATE SET status = 'ACTIVE', left_at = NULL`,
        [app.organization_id, app.applicant_id]
      );
    }

    res.json({ message: `Application ${status.toLowerCase()} successfully`, application: app });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
