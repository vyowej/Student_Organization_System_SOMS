/**
 * Organization Members & Applications Routes (backend/routes/members.js)
 *
 * Links to `organization_members` and `organization_applications` tables
 * and respects the `trg_members_eligibility` / `trg_applications_eligibility`
 * database triggers in ../database/student_org_db.sql.
 */
const express = require('express');
const router = express.Router();
const db = require('../db');

const VALID_POSITIONS = [
  'PRESIDENT',
  'VICE_PRESIDENT',
  'SECRETARY',
  'TREASURER',
  'AUDITOR',
  'PRO',
  'OTHER_OFFICER',
  'MEMBER',
];

function normalizePositionAndTitle(positionInput, customTitleInput) {
  if (!positionInput || String(positionInput).trim().toLowerCase() === 'member' || String(positionInput).trim() === 'None') {
    return { position: 'MEMBER', custom_title: null };
  }
  const raw = String(positionInput).trim();
  const upper = raw.toUpperCase().replace(/[\s.-]+/g, '_');
  if (VALID_POSITIONS.includes(upper)) {
    return {
      position: upper,
      custom_title: customTitleInput ? String(customTitleInput).trim() : (upper === 'OTHER_OFFICER' ? raw : null),
    };
  }
  if (upper === 'PUBLIC_RELATIONS_OFFICER' || upper === 'P_R_O_' || upper === 'P_R_O') {
    return { position: 'PRO', custom_title: customTitleInput || null };
  }
  return {
    position: 'OTHER_OFFICER',
    custom_title: customTitleInput ? String(customTitleInput).trim() : raw,
  };
}

async function resolveStudentDbId(identifier) {
  if (!identifier) return null;
  if (Number.isFinite(Number(identifier))) {
    const byId = await db.query('SELECT id FROM students WHERE id = $1 OR user_id = $1 ORDER BY CASE WHEN id = $1 THEN 0 ELSE 1 END LIMIT 1', [Number(identifier)]);
    if (byId.rows.length > 0) return byId.rows[0].id;
  }
  const byNumber = await db.query('SELECT id FROM students WHERE lower(student_number) = lower($1) LIMIT 1', [String(identifier).trim()]);
  if (byNumber.rows.length > 0) return byNumber.rows[0].id;
  return null;
}

const MEMBER_SELECT_QUERY = `
  SELECT om.id,
         om.organization_id,
         om.student_id,
         om.position,
         om.custom_title,
         om.status,
         om.joined_at,
         om.left_at,
         o.name AS organization_name,
         o.acronym AS organization_acronym,
         o.logo AS organization_logo,
         o.scope AS organization_scope,
         o.org_type AS organization_type,
         s.user_id,
         s.student_number,
         s.program_id,
         s.year_level,
         u.first_name,
         u.last_name,
         (u.last_name || ', ' || u.first_name) AS name,
         u.email,
         p.name AS program_name,
         p.acronym AS program_acronym,
         d.id AS department_id,
         d.name AS department_name,
         c.id AS college_id,
         c.name AS college_name,
         c.acronym AS college_acronym
    FROM organization_members om
    JOIN organizations o ON o.id = om.organization_id
    JOIN students s ON s.id = om.student_id
    JOIN users u ON u.id = s.user_id
    JOIN programs p ON p.id = s.program_id
    JOIN departments d ON d.id = p.department_id
    JOIN colleges c ON c.id = d.college_id
`;

// GET /api/members — List all organization members with optional filters
router.get('/', async (req, res) => {
  try {
    const { organization_id, student_id, status } = req.query;
    let queryText = `${MEMBER_SELECT_QUERY} WHERE 1=1`;
    const params = [];

    if (organization_id) {
      params.push(organization_id);
      queryText += ` AND om.organization_id = $${params.length}`;
    }
    if (student_id) {
      const resolvedId = await resolveStudentDbId(student_id);
      params.push(resolvedId || -1);
      queryText += ` AND om.student_id = $${params.length}`;
    }
    if (status) {
      params.push(String(status).toUpperCase());
      queryText += ` AND om.status = $${params.length}`;
    }

    queryText += `
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
        u.last_name ASC
    `;

    const result = await db.query(queryText, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/members/org/:organization_id — List members and officers for an organization ordered by position hierarchy
router.get('/org/:organization_id', async (req, res) => {
  try {
    const { organization_id } = req.params;
    const { status } = req.query;
    let queryText = `${MEMBER_SELECT_QUERY} WHERE om.organization_id = $1`;
    const params = [organization_id];

    if (status) {
      params.push(String(status).toUpperCase());
      queryText += ` AND om.status = $${params.length}`;
    }

    queryText += `
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
        u.last_name ASC
    `;

    const result = await db.query(queryText, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/members/student/:student_id — List all organization memberships for a student
router.get('/student/:student_id', async (req, res) => {
  try {
    const resolvedStudentId = await resolveStudentDbId(req.params.student_id);
    if (!resolvedStudentId) return res.json([]);

    const result = await db.query(
      `${MEMBER_SELECT_QUERY}
        WHERE om.student_id = $1
        ORDER BY om.joined_at DESC`,
      [resolvedStudentId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/members — Add a student to an organization (enforces trg_members_eligibility trigger)
router.post('/', async (req, res) => {
  try {
    const { organization_id, student_id, user_id, position, custom_title } = req.body;
    const resolvedStudentId = await resolveStudentDbId(student_id || user_id);

    if (!organization_id || !resolvedStudentId) {
      return res.status(400).json({ error: 'organization_id and a valid student_id are required' });
    }

    const { position: memberPosition, custom_title: customTitle } = normalizePositionAndTitle(position, custom_title);

    const insertRes = await db.query(
      `INSERT INTO organization_members (organization_id, student_id, position, custom_title, status)
       VALUES ($1, $2, $3, $4, 'ACTIVE')
       ON CONFLICT (organization_id, student_id)
       DO UPDATE SET position = EXCLUDED.position,
                     custom_title = EXCLUDED.custom_title,
                     status = 'ACTIVE',
                     left_at = NULL
       RETURNING id`,
      [organization_id, resolvedStudentId, memberPosition, customTitle]
    );

    const fullRow = await db.query(`${MEMBER_SELECT_QUERY} WHERE om.id = $1`, [insertRes.rows[0].id]);
    res.status(201).json(fullRow.rows[0]);
  } catch (err) {
    console.error(err);
    // Catch eligibility trigger exception from student_can_join() in database/student_org_db.sql
    if (err.message && err.message.includes('Student is not eligible')) {
      return res.status(403).json({ error: err.message });
    }
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

// PUT /api/members/:id/position — Update a member's position, custom officer title, or status
router.put('/:id/position', async (req, res) => {
  try {
    const { id } = req.params;
    const { position, custom_title, status } = req.body;

    const existingRes = await db.query('SELECT * FROM organization_members WHERE id = $1', [id]);
    if (existingRes.rows.length === 0) {
      return res.status(404).json({ error: 'Membership record not found' });
    }
    const current = existingRes.rows[0];

    let nextPosition = current.position;
    let nextCustomTitle = current.custom_title;

    if (position !== undefined || custom_title !== undefined) {
      const normalized = normalizePositionAndTitle(
        position !== undefined ? position : current.position,
        custom_title !== undefined ? custom_title : current.custom_title
      );
      nextPosition = normalized.position;
      nextCustomTitle = normalized.custom_title;
    }

    const nextStatus = status && ['ACTIVE', 'INACTIVE', 'SUSPENDED'].includes(String(status).toUpperCase())
      ? String(status).toUpperCase()
      : current.status;

    const nextLeftAt = nextStatus === 'INACTIVE' ? new Date() : (nextStatus === 'ACTIVE' ? null : current.left_at);

    await db.query(
      `UPDATE organization_members
          SET position = $2,
              custom_title = $3,
              status = $4,
              left_at = $5
        WHERE id = $1`,
      [id, nextPosition, nextCustomTitle, nextStatus, nextLeftAt]
    );

    // Sync users.role with officer status if user is a STUDENT/OFFICER
    const stdRes = await db.query('SELECT user_id FROM students WHERE id = $1', [current.student_id]);
    if (stdRes.rows.length > 0) {
      const userId = stdRes.rows[0].user_id;
      const officerCountRes = await db.query(
        `SELECT COUNT(*)::int AS cnt
           FROM organization_members
          WHERE student_id = $1 AND status = 'ACTIVE' AND position != 'MEMBER'`,
        [current.student_id]
      );
      const isAnyOfficer = officerCountRes.rows[0].cnt > 0;
      await db.query(
        `UPDATE users
            SET role = CASE WHEN $2 THEN 'OFFICER'::user_role ELSE 'STUDENT'::user_role END
          WHERE id = $1 AND role IN ('STUDENT', 'OFFICER')`,
        [userId, isAnyOfficer]
      );
    }

    const fullRow = await db.query(`${MEMBER_SELECT_QUERY} WHERE om.id = $1`, [id]);
    res.json(fullRow.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

// DELETE /api/members/:id — Deactivate a membership and set left_at timestamp
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

const APPLICATION_SELECT_QUERY = `
  SELECT oa.id,
         oa.organization_id,
         oa.applicant_id,
         oa.message,
         oa.status,
         oa.reviewed_by,
         oa.review_remarks,
         oa.created_at,
         oa.reviewed_at,
         o.name AS organization_name,
         o.acronym AS organization_acronym,
         s.user_id,
         s.student_number,
         s.year_level,
         u.first_name,
         u.last_name,
         (u.last_name || ', ' || u.first_name) AS name,
         u.email,
         p.name AS program_name,
         p.acronym AS program_acronym,
         d.name AS department_name,
         c.name AS college_name,
         CASE WHEN ru.id IS NOT NULL THEN (ru.last_name || ', ' || ru.first_name) ELSE NULL END AS reviewer_name
    FROM organization_applications oa
    JOIN organizations o ON o.id = oa.organization_id
    JOIN students s ON s.id = oa.applicant_id
    JOIN users u ON u.id = s.user_id
    JOIN programs p ON p.id = s.program_id
    JOIN departments d ON d.id = p.department_id
    JOIN colleges c ON c.id = d.college_id
    LEFT JOIN users ru ON ru.id = oa.reviewed_by
`;

// GET /api/members/applications — List all applications (for Admin, Officer, or Student)
router.get('/applications', async (req, res) => {
  try {
    const { status, student_id, organization_id } = req.query;
    let queryText = `${APPLICATION_SELECT_QUERY} WHERE 1=1`;
    const params = [];

    if (status) {
      params.push(String(status).toUpperCase());
      queryText += ` AND oa.status = $${params.length}`;
    }
    if (student_id) {
      const resolvedId = await resolveStudentDbId(student_id);
      params.push(resolvedId || -1);
      queryText += ` AND oa.applicant_id = $${params.length}`;
    }
    if (organization_id) {
      params.push(organization_id);
      queryText += ` AND oa.organization_id = $${params.length}`;
    }

    queryText += ' ORDER BY oa.created_at DESC';

    const result = await db.query(queryText, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/members/applications/org/:organization_id — List membership applications for an organization
router.get('/applications/org/:organization_id', async (req, res) => {
  try {
    const { organization_id } = req.params;
    const result = await db.query(
      `${APPLICATION_SELECT_QUERY}
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

// POST /api/members/applications — Submit an application to join an organization (enforces trg_applications_eligibility)
router.post('/applications', async (req, res) => {
  try {
    const { organization_id, applicant_id, student_id, user_id, message } = req.body;
    const resolvedApplicantId = await resolveStudentDbId(applicant_id || student_id || user_id);

    if (!organization_id || !resolvedApplicantId) {
      return res.status(400).json({ error: 'organization_id and a valid student applicant_id are required' });
    }

    const insertRes = await db.query(
      `INSERT INTO organization_applications (organization_id, applicant_id, message, status)
       VALUES ($1, $2, $3, 'PENDING')
       RETURNING id`,
      [organization_id, resolvedApplicantId, message || null]
    );

    const fullRow = await db.query(`${APPLICATION_SELECT_QUERY} WHERE oa.id = $1`, [insertRes.rows[0].id]);
    res.status(201).json(fullRow.rows[0]);
  } catch (err) {
    console.error(err);
    if (err.message && err.message.includes('Student is not eligible')) {
      return res.status(403).json({ error: err.message });
    }
    if (err.code === '23505') {
      return res.status(409).json({ error: 'You already have a pending application for this organization' });
    }
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

// PUT /api/members/applications/:id/review — Approve, reject, or cancel a membership application
router.put('/applications/:id/review', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reviewed_by, review_remarks } = req.body;
    const normalizedStatus = String(status || '').toUpperCase();

    if (!['APPROVED', 'REJECTED', 'CANCELLED'].includes(normalizedStatus)) {
      return res.status(400).json({ error: "status must be 'APPROVED', 'REJECTED', or 'CANCELLED'" });
    }

    const appResult = await db.query(
      `UPDATE organization_applications
          SET status = $2,
              reviewed_by = $3,
              review_remarks = $4,
              reviewed_at = now()
        WHERE id = $1
        RETURNING *`,
      [id, normalizedStatus, reviewed_by || null, review_remarks || null]
    );

    if (appResult.rows.length === 0) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const app = appResult.rows[0];

    // Automatically enroll student into organization_members when application is approved
    let memberRecord = null;
    if (normalizedStatus === 'APPROVED') {
      const memRes = await db.query(
        `INSERT INTO organization_members (organization_id, student_id, position, status)
         VALUES ($1, $2, 'MEMBER', 'ACTIVE')
         ON CONFLICT (organization_id, student_id)
         DO UPDATE SET status = 'ACTIVE', left_at = NULL
         RETURNING id`,
        [app.organization_id, app.applicant_id]
      );
      const fullMem = await db.query(`${MEMBER_SELECT_QUERY} WHERE om.id = $1`, [memRes.rows[0].id]);
      memberRecord = fullMem.rows[0] || null;
    }

    const fullApp = await db.query(`${APPLICATION_SELECT_QUERY} WHERE oa.id = $1`, [id]);
    res.json({
      message: `Application ${normalizedStatus.toLowerCase()} successfully`,
      application: fullApp.rows[0],
      member: memberRecord,
    });
  } catch (err) {
    console.error(err);
    if (err.message && err.message.includes('Student is not eligible')) {
      return res.status(403).json({ error: err.message });
    }
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

module.exports = router;
