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
const {
  notifyUser,
  notifyAdvisersForOrg,
  recordAuditLog,
} = require('../notificationsHelper');

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

const SINGLE_SEAT_ROLES = [
  'PRESIDENT',
  'VICE_PRESIDENT',
  'SECRETARY',
  'TREASURER',
  'AUDITOR',
  'PRO',
];

function normalizePositionAndTitle(positionInput, customTitleInput) {
  if (!positionInput || String(positionInput).trim().toLowerCase() === 'member' || String(positionInput).trim() === 'None' || String(positionInput).trim().toLowerCase() === 'general member') {
    return { position: 'MEMBER', custom_title: null };
  }
  const raw = String(positionInput).trim();
  const upper = raw.toUpperCase().replace(/[\s.-]+/g, '_');
  if (upper === 'PUBLIC_RELATIONS_OFFICER' || upper === 'P_R_O_' || upper === 'P_R_O' || upper === 'PIO' || upper === 'PUBLIC_INFORMATION_OFFICER' || upper === 'P_I_O') {
    return { position: 'PRO', custom_title: customTitleInput || null };
  }
  if (VALID_POSITIONS.includes(upper)) {
    return {
      position: upper,
      custom_title: customTitleInput ? String(customTitleInput).trim() : (upper === 'OTHER_OFFICER' ? raw : null),
    };
  }
  if (upper === 'VICE_PRES' || upper === 'VP') {
    return { position: 'VICE_PRESIDENT', custom_title: customTitleInput || null };
  }
  return {
    position: 'OTHER_OFFICER',
    custom_title: customTitleInput ? String(customTitleInput).trim() : raw,
  };
}

async function resolveStudentDbId(identifier) {
  if (!identifier) return null;
  const num = Number(identifier);
  if (Number.isFinite(num)) {
    const byId = await db.query(
      'SELECT id FROM students WHERE id = $1 OR user_id = $1 ORDER BY CASE WHEN id = $1 THEN 0 ELSE 1 END LIMIT 1',
      [num]
    );
    if (byId.rows.length > 0) return byId.rows[0].id;

    // If identifier is a valid user ID with role STUDENT/OFFICER, ensure they have a students row
    const userCheck = await db.query(
      "SELECT id, role, email FROM users WHERE id = $1 AND role IN ('STUDENT', 'OFFICER')",
      [num]
    );
    if (userCheck.rows.length > 0) {
      let progRes = await db.query('SELECT id FROM programs ORDER BY id ASC LIMIT 1');
      let progId = progRes.rows[0]?.id;
      if (!progId) {
        const col = await db.query(
          "INSERT INTO colleges (name, acronym) VALUES ('College of Computing Studies', 'CCS') ON CONFLICT (acronym) DO UPDATE SET name = EXCLUDED.name RETURNING id"
        );
        const dept = await db.query(
          "INSERT INTO departments (college_id, name, acronym) VALUES ($1, 'Department of Computer Science', 'DCS') ON CONFLICT (college_id, name) DO UPDATE SET acronym = EXCLUDED.acronym RETURNING id",
          [col.rows[0].id]
        );
        const prog = await db.query(
          "INSERT INTO programs (department_id, name, acronym) VALUES ($1, 'Bachelor of Science in Computer Science', 'BSCS') ON CONFLICT (acronym) DO UPDATE SET name = EXCLUDED.name RETURNING id",
          [dept.rows[0].id]
        );
        progId = prog.rows[0].id;
      }
      const newStd = await db.query(
        `INSERT INTO students (user_id, student_number, program_id, year_level)
         VALUES ($1, $2, $3, 1)
         ON CONFLICT (user_id) DO UPDATE SET updated_at = now()
         RETURNING id`,
        [num, `STD-${num}`, progId]
      );
      return newStd.rows[0].id;
    }
  }

  const str = String(identifier).trim();
  const byNumber = await db.query('SELECT id FROM students WHERE lower(student_number) = lower($1) LIMIT 1', [str]);
  if (byNumber.rows.length > 0) return byNumber.rows[0].id;

  const byEmail = await db.query(
    'SELECT s.id FROM students s JOIN users u ON u.id = s.user_id WHERE lower(u.email) = lower($1) LIMIT 1',
    [str]
  );
  if (byEmail.rows.length > 0) return byEmail.rows[0].id;

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
         u.middle_name,
         u.last_name,
         u.suffix,
         (u.last_name || ', ' || u.first_name || COALESCE(' ' || u.suffix, '')) AS name,
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

    // Automatically sync users.role to OFFICER if assigned an officer position
    if (memberPosition !== 'MEMBER') {
      const stdRes = await db.query('SELECT user_id FROM students WHERE id = $1', [resolvedStudentId]);
      if (stdRes.rows.length > 0) {
        await db.query(
          "UPDATE users SET role = 'OFFICER'::user_role WHERE id = $1 AND role = 'STUDENT'",
          [stdRes.rows[0].user_id]
        );
      }
    }

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

    // If assigning a single-seat officer position, reassign previous active holder to General Member
    if (nextStatus === 'ACTIVE' && SINGLE_SEAT_ROLES.includes(nextPosition)) {
      const prevHolders = await db.query(
        `SELECT om.id, om.student_id, s.user_id
           FROM organization_members om
           JOIN students s ON s.id = om.student_id
          WHERE om.organization_id = $1
            AND om.position = $2
            AND om.status = 'ACTIVE'
            AND om.id != $3`,
        [current.organization_id, nextPosition, id]
      );

      if (prevHolders.rows.length > 0) {
        await db.query(
          `UPDATE organization_members
              SET position = 'MEMBER',
                  custom_title = NULL
            WHERE organization_id = $1
              AND position = $2
              AND id != $3
              AND status = 'ACTIVE'`,
          [current.organization_id, nextPosition, id]
        );

        for (const prev of prevHolders.rows) {
          const checkOff = await db.query(
            `SELECT COUNT(*)::int AS cnt
               FROM organization_members
              WHERE student_id = $1 AND status = 'ACTIVE' AND position != 'MEMBER'`,
            [prev.student_id]
          );
          if (checkOff.rows[0].cnt === 0) {
            await db.query(
              "UPDATE users SET role = 'STUDENT' WHERE id = $1 AND role = 'OFFICER'",
              [prev.user_id]
            );
          }
        }
      }
    }

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
    const memRow = fullRow.rows[0];

    // Notify assigned faculty adviser of membership / officer position changes
    if (memRow) {
      await notifyAdvisersForOrg(current.organization_id, {
        type: 'MEMBERSHIP',
        title: `Member Role Updated: ${memRow.name || 'Member'}`,
        message: `Officer role or status for "${memRow.name}" in ${memRow.organization_name || 'organization'} was changed to ${nextPosition} (${nextStatus}).`,
      });
      await recordAuditLog({
        userId: null,
        action: 'UPDATE_MEMBER_ROLE',
        entity: 'organization_members',
        entityId: id,
        metadata: { student_id: current.student_id, organization_id: current.organization_id, position: nextPosition, status: nextStatus },
      });
    }

    res.json(memRow);
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
         u.middle_name,
         u.last_name,
         u.suffix,
         (u.last_name || ', ' || u.first_name || COALESCE(' ' || u.suffix, '')) AS name,
         u.email,
         p.name AS program_name,
         p.acronym AS program_acronym,
         d.name AS department_name,
         c.name AS college_name,
         CASE WHEN ru.id IS NOT NULL THEN (ru.last_name || ', ' || ru.first_name || COALESCE(' ' || ru.suffix, '')) ELSE NULL END AS reviewer_name
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
    const { organization_id, applicant_id, student_id, user_id, message, reason } = req.body;
    const rawOrgId = typeof organization_id === 'object' && organization_id !== null
      ? (organization_id.id || organization_id.organization_id || organization_id.organizationId)
      : organization_id;
    const orgIdNum = Number(rawOrgId);

    const resolvedApplicantId = await resolveStudentDbId(applicant_id || student_id || user_id);

    if (!orgIdNum || !resolvedApplicantId) {
      return res.status(400).json({ error: 'A valid organization ID and student ID are required' });
    }

    const desiredRoleUpper = String(req.body.desired_role || req.body.desiredRole || req.body.position || '').toUpperCase();
    if (desiredRoleUpper.includes('PRESIDENT')) {
      const presCheck = await db.query(
        `SELECT om.id, u.first_name, u.last_name
           FROM organization_members om
           JOIN students s ON s.id = om.student_id
           JOIN users u ON u.id = s.user_id
          WHERE om.organization_id = $1
            AND om.position = 'PRESIDENT'
            AND om.status = 'ACTIVE'
            AND om.student_id != $2`,
        [orgIdNum, resolvedApplicantId]
      );
      if (presCheck.rows.length > 0) {
        const pres = presCheck.rows[0];
        return res.status(400).json({
          error: `This organization already has an active President (${pres.first_name} ${pres.last_name}). You cannot apply as President.`,
        });
      }
    }

    const appMsg = message || reason || null;

    const insertRes = await db.query(
      `INSERT INTO organization_applications (organization_id, applicant_id, message, status)
       VALUES ($1, $2, $3, 'PENDING')
       RETURNING id`,
      [orgIdNum, resolvedApplicantId, appMsg]
    );

    const fullRow = await db.query(`${APPLICATION_SELECT_QUERY} WHERE oa.id = $1`, [insertRes.rows[0].id]);
    const appRow = fullRow.rows[0];

    // Dispatch notification to the applicant
    if (appRow?.user_id) {
      await notifyUser(appRow.user_id, {
        type: 'MEMBERSHIP',
        title: `Application Submitted: ${appRow.organization_name || 'Organization'}`,
        message: `Your membership application to ${appRow.organization_name} has been received and is pending officer review.`,
      });
    }

    // Notify assigned faculty adviser of the new application
    await notifyAdvisersForOrg(orgIdNum, {
      type: 'MEMBERSHIP',
      title: `Membership Application: ${appRow.organization_name || 'Organization'}`,
      message: `${appRow.name || 'A student'} applied to join ${appRow.organization_name || 'your organization'}.`,
    });

    // Record audit log
    await recordAuditLog({
      userId: appRow?.user_id || null,
      action: 'SUBMIT_MEMBERSHIP_APPLICATION',
      entity: 'organization_applications',
      entityId: appRow.id,
      metadata: { organization_id: orgIdNum, applicant_id: resolvedApplicantId },
    });

    res.status(201).json(appRow);
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
    const { status, reviewed_by, review_remarks, reason, position, custom_title } = req.body;
    const normalizedStatus = String(status || '').toUpperCase();

    if (!['APPROVED', 'REJECTED', 'CANCELLED'].includes(normalizedStatus)) {
      return res.status(400).json({ error: "status must be 'APPROVED', 'REJECTED', or 'CANCELLED'" });
    }

    let reviewerId = null;
    if (reviewed_by) {
      const numId = Number(reviewed_by);
      if (Number.isInteger(numId) && numId > 0) {
        const u = await db.query('SELECT id FROM users WHERE id = $1', [numId]);
        if (u.rows.length > 0) reviewerId = numId;
      }
    }
    const remarks = review_remarks || reason || null;

    const appResult = await db.query(
      `UPDATE organization_applications
          SET status = $2,
              reviewed_by = $3,
              review_remarks = $4,
              reviewed_at = now()
        WHERE id = $1
        RETURNING *`,
      [id, normalizedStatus, reviewerId, remarks]
    );

    if (appResult.rows.length === 0) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const app = appResult.rows[0];

    // Automatically enroll student into organization_members when application is approved
    let memberRecord = null;
    if (normalizedStatus === 'APPROVED') {
      const assignedPos = position ? normalizePositionAndTitle(position, custom_title) : { position: 'MEMBER', custom_title: null };

      // If assigning a single-seat officer position, reassign previous active holder to General Member
      if (SINGLE_SEAT_ROLES.includes(assignedPos.position)) {
        const prevHolders = await db.query(
          `SELECT om.id, om.student_id, s.user_id
             FROM organization_members om
             JOIN students s ON s.id = om.student_id
            WHERE om.organization_id = $1
              AND om.position = $2
              AND om.status = 'ACTIVE'
              AND om.student_id != $3`,
          [app.organization_id, assignedPos.position, app.applicant_id]
        );

        if (prevHolders.rows.length > 0) {
          await db.query(
            `UPDATE organization_members
                SET position = 'MEMBER',
                    custom_title = NULL
              WHERE organization_id = $1
                AND position = $2
                AND student_id != $3
                AND status = 'ACTIVE'`,
            [app.organization_id, assignedPos.position, app.applicant_id]
          );

          for (const prev of prevHolders.rows) {
            const checkOff = await db.query(
              `SELECT COUNT(*)::int AS cnt
                 FROM organization_members
                WHERE student_id = $1 AND status = 'ACTIVE' AND position != 'MEMBER'`,
              [prev.student_id]
            );
            if (checkOff.rows[0].cnt === 0) {
              await db.query(
                "UPDATE users SET role = 'STUDENT' WHERE id = $1 AND role = 'OFFICER'",
                [prev.user_id]
              );
            }
          }
        }
      }

      const memRes = await db.query(
        `INSERT INTO organization_members (organization_id, student_id, position, custom_title, status)
         VALUES ($1, $2, $3, $4, 'ACTIVE')
         ON CONFLICT (organization_id, student_id)
         DO UPDATE SET status = 'ACTIVE', position = EXCLUDED.position, custom_title = EXCLUDED.custom_title, left_at = NULL
         RETURNING id`,
        [app.organization_id, app.applicant_id, assignedPos.position, assignedPos.custom_title]
      );
      const fullMem = await db.query(`${MEMBER_SELECT_QUERY} WHERE om.id = $1`, [memRes.rows[0].id]);
      memberRecord = fullMem.rows[0] || null;

      // Automatically sync users.role with active officer status
      const stdRes = await db.query('SELECT user_id FROM students WHERE id = $1', [app.applicant_id]);
      if (stdRes.rows.length > 0) {
        const userId = stdRes.rows[0].user_id;
        const officerCountRes = await db.query(
          `SELECT COUNT(*)::int AS cnt
             FROM organization_members
            WHERE student_id = $1 AND status = 'ACTIVE' AND position != 'MEMBER'`,
          [app.applicant_id]
        );
        const isAnyOfficer = officerCountRes.rows[0].cnt > 0;
        await db.query(
          `UPDATE users
              SET role = CASE WHEN $2 THEN 'OFFICER'::user_role ELSE 'STUDENT'::user_role END
            WHERE id = $1 AND role IN ('STUDENT', 'OFFICER')`,
          [userId, isAnyOfficer]
        );
      }
    }

    const fullApp = await db.query(`${APPLICATION_SELECT_QUERY} WHERE oa.id = $1`, [id]);
    const reviewedApp = fullApp.rows[0];

    // 1. Dispatch notification to the applicant regarding application decision
    if (reviewedApp?.user_id) {
      const isApproved = normalizedStatus === 'APPROVED';
      const notifTitle = isApproved
        ? `Membership Approved: ${reviewedApp.organization_name || 'Organization'}`
        : `Application Update: ${reviewedApp.organization_name || 'Organization'}`;
      const notifMessage = isApproved
        ? `Congratulations! Your membership application to ${reviewedApp.organization_name} has been approved.`
        : `Your membership application to ${reviewedApp.organization_name} was not approved.${remarks ? ` Remarks: ${remarks}` : ''}`;

      await notifyUser(reviewedApp.user_id, {
        type: 'MEMBERSHIP',
        title: notifTitle,
        message: notifMessage,
      });
    }

    // 2. Notify assigned faculty adviser of officer's membership decision
    await notifyAdvisersForOrg(reviewedApp.organization_id, {
      type: 'MEMBERSHIP',
      title: `Application ${normalizedStatus}: ${reviewedApp.name || 'Student'}`,
      message: `Officer reviewed membership application for ${reviewedApp.name || 'Student'} in ${reviewedApp.organization_name}: ${normalizedStatus}.${remarks ? ` Remarks: ${remarks}` : ''}`,
    });

    // 3. If reviewed by an officer, send confirmation notification to the reviewing officer
    if (reviewerId) {
      await notifyUser(reviewerId, {
        type: 'CONFIRMATION',
        title: `Application Review Recorded: ${reviewedApp.name || 'Applicant'}`,
        message: `You marked ${reviewedApp.name || 'applicant'}'s application for ${reviewedApp.organization_name} as ${normalizedStatus}.`,
      });
    }

    // 4. Record audit log
    await recordAuditLog({
      userId: reviewerId || null,
      action: `REVIEW_APPLICATION_${normalizedStatus}`,
      entity: 'organization_applications',
      entityId: id,
      metadata: { organization_id: reviewedApp.organization_id, applicant_id: reviewedApp.applicant_id, status: normalizedStatus },
    });

    res.json({
      message: `Application ${normalizedStatus.toLowerCase()} successfully`,
      application: reviewedApp,
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
