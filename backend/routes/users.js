/**
 * Users & Authentication Routes (backend/routes/users.js)
 *
 * Links to the `users`, `students`, `advisers`, `programs`, `departments`,
 * `colleges`, `organization_members`, and `organization_advisers` tables
 * (`user_role` and `user_status` ENUMs) in ../database/student_org_db.sql.
 */
const express = require('express');
const router = express.Router();
// Prefer native bcrypt, with automatic fallback to pure-JS bcryptjs
let bcrypt;
try {
  bcrypt = require('bcrypt');
} catch {
  bcrypt = require('bcryptjs');
}
const db = require('../db');
const { resolvePositiveInt } = require('../utils');
const { notifyAdmins, notifyUser, recordAuditLog } = require('../notificationsHelper');

function formatYearLevelLabel(yearNum) {
  const n = Number(yearNum);
  if (!Number.isFinite(n) || n < 1) return null;
  if (n === 1) return '1st Year';
  if (n === 2) return '2nd Year';
  if (n === 3) return '3rd Year';
  return `${n}th Year`;
}

function parseYearLevelNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.min(Math.max(Math.trunc(value), 1), 6);
  }
  const match = String(value || '').match(/\d+/);
  const parsed = match ? parseInt(match[0], 10) : 1;
  return Math.min(Math.max(parsed || 1, 1), 6);
}

/**
 * Resolves a program_id by ID, acronym, or name. If the database has no
 * programs yet, creates the college/department/program entry so student
 * registration links cleanly to `programs` in student_org_db.sql.
 */
async function resolveOrEnsureProgramId(programIdInput, programLabelInput) {
  if (programIdInput && Number.isFinite(Number(programIdInput))) {
    const check = await db.query('SELECT id FROM programs WHERE id = $1', [Number(programIdInput)]);
    if (check.rows.length > 0) return check.rows[0].id;
  }

  const label = String(programLabelInput || 'BSCS').trim();
  if (label) {
    const parenMatch = label.match(/\(([^)]+)\)\s*$/);
    const extractedCode = parenMatch ? parenMatch[1].trim() : label.split('—')[0].trim();
    const found = await db.query(
      'SELECT id FROM programs WHERE lower(acronym) = lower($1) OR lower(name) = lower($1) OR lower(acronym) = lower($2) LIMIT 1',
      [label, extractedCode]
    );
    if (found.rows.length > 0) return found.rows[0].id;
  }

  const existingAny = await db.query('SELECT id FROM programs ORDER BY id ASC LIMIT 1');
  if (existingAny.rows.length > 0 && !label) {
    return existingAny.rows[0].id;
  }

  // Ensure a parent college & department exist for this program acronym/name
  let collegeId;
  const colRes = await db.query('SELECT id FROM colleges ORDER BY id ASC LIMIT 1');
  if (colRes.rows.length > 0) {
    collegeId = colRes.rows[0].id;
  } else {
    const newCol = await db.query(
      `INSERT INTO colleges (name, acronym)
       VALUES ('College of Computing Studies', 'CCS')
       ON CONFLICT (acronym) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`
    );
    collegeId = newCol.rows[0].id;
  }

  let deptId;
  const deptRes = await db.query('SELECT id FROM departments WHERE college_id = $1 ORDER BY id ASC LIMIT 1', [collegeId]);
  if (deptRes.rows.length > 0) {
    deptId = deptRes.rows[0].id;
  } else {
    const newDept = await db.query(
      `INSERT INTO departments (college_id, name, acronym)
       VALUES ($1, 'Department of Computer Science', 'DCS')
       ON CONFLICT (college_id, name) DO UPDATE SET acronym = EXCLUDED.acronym
       RETURNING id`,
      [collegeId]
    );
    deptId = newDept.rows[0].id;
  }

  const acronym = label.length <= 20 ? label.toUpperCase() : label.slice(0, 20).toUpperCase();
  const progName = label.length <= 10 ? `Bachelor of Science in ${acronym}` : label;
  const createdProg = await db.query(
    `INSERT INTO programs (department_id, name, acronym)
     VALUES ($1, $2, $3)
     ON CONFLICT (acronym) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
    [deptId, progName, acronym]
  );
  return createdProg.rows[0].id;
}

/**
 * Builds a complete user profile with linked student, adviser, academic,
 * and organization membership/adviser records. Accepts an integer ID, string ID,
 * email, or student/employee number.
 */
async function buildUserProfile(target) {
  if (!target) return null;
  const raw = String(target).trim();
  const isNumeric = /^\d+$/.test(raw);

  const userRes = await db.query(
    `SELECT u.id, u.email, u.first_name, u.middle_name, u.last_name, u.suffix, u.role, u.status, u.created_at, u.updated_at,
            s.id AS student_db_id, s.student_number, s.program_id, s.year_level,
            s.cor_file_name, (s.cor_file_data IS NOT NULL) AS has_cor,
            p.name AS program_name, p.acronym AS program_acronym,
            d.id AS department_id, d.name AS department_name, d.acronym AS department_acronym,
            c.id AS student_college_id, c.name AS student_college_name, c.acronym AS student_college_acronym,
            a.id AS adviser_db_id, a.employee_number, a.is_coordinator, a.college_id AS adviser_college_id,
            ac.name AS adviser_college_name, ac.acronym AS adviser_college_acronym
       FROM users u
  LEFT JOIN students s ON s.user_id = u.id
  LEFT JOIN programs p ON p.id = s.program_id
  LEFT JOIN departments d ON d.id = p.department_id
  LEFT JOIN colleges c ON c.id = d.college_id
  LEFT JOIN advisers a ON a.user_id = u.id
  LEFT JOIN colleges ac ON ac.id = a.college_id
      WHERE ($1::boolean AND u.id = $2::integer)
         OR lower(u.email) = lower($3)
         OR lower(COALESCE(s.student_number, '')) = lower($3)
         OR lower(COALESCE(a.employee_number, '')) = lower($3)
      LIMIT 1`,
    [isNumeric, isNumeric ? parseInt(raw, 10) : 0, raw]
  );

  if (userRes.rows.length === 0) return null;
  const row = userRes.rows[0];

  const isCoordinator = Boolean(
    row.is_coordinator ||
    String(row.email || '').trim().toLowerCase() === 'marjorie.rojas@wmsu.edu.ph'
  );
  const effectivePrimaryRole = row.role === 'STUDENT' ? 'OFFICER' : row.role;
  const roles = [effectivePrimaryRole];
  if (effectivePrimaryRole === 'ADMIN') {
    roles.push('ADVISER', 'OFFICER');
  } else if (effectivePrimaryRole === 'ADVISER' && isCoordinator && !roles.includes('ADMIN')) {
    roles.push('ADMIN');
  }

  let organizationRoles = [];
  let organizationIds = [];
  let organizationId = null;
  let organizationName = null;
  let position = null;
  let customTitle = null;
  let committee = null;
  let allMemberships = [];
  let hasActiveOrg = false;

  if (row.student_db_id) {
    const memberRes = await db.query(
      `SELECT om.id, om.organization_id, om.position, om.custom_title, om.committee, om.status,
              o.name AS organization_name, o.acronym AS organization_acronym
         FROM organization_members om
         JOIN organizations o ON o.id = om.organization_id
        WHERE om.student_id = $1 AND om.status = 'ACTIVE'
        ORDER BY CASE WHEN om.position != 'MEMBER' THEN 0 ELSE 1 END, om.joined_at ASC`,
      [row.student_db_id]
    );

    const activeMemberships = memberRes.rows.filter(
      (m) => m.status === 'ACTIVE'
    );
    const activeOfficerMemberships = activeMemberships.filter(
      (m) => m.position && m.position !== 'MEMBER'
    );

    const effectiveMemberships = activeOfficerMemberships.length > 0 ? activeOfficerMemberships : activeMemberships;

    organizationRoles = effectiveMemberships.map((m) => ({
      organizationId: m.organization_id,
      organizationName: m.organization_name,
      organizationAcronym: m.organization_acronym,
      position: m.custom_title || (m.position === 'MEMBER' ? 'Committee Officer' : m.position),
      customTitle: m.custom_title,
      committee: m.committee || null,
      positions: [m.custom_title || (m.position === 'MEMBER' ? 'Committee Officer' : m.position)],
    }));

    allMemberships = memberRes.rows.map((m) => ({
      organizationId: m.organization_id,
      organizationName: m.organization_name,
      organizationAcronym: m.organization_acronym,
      position: m.position,
      customTitle: m.custom_title,
      committee: m.committee || null,
      positions: [m.custom_title || m.position],
      status: m.status,
    }));

    const primaryMembership = effectiveMemberships[0] || memberRes.rows[0] || null;
    if (primaryMembership) {
      organizationId = primaryMembership.organization_id;
      organizationName = primaryMembership.organization_name;
      position = primaryMembership.position;
      customTitle = primaryMembership.custom_title;
      committee = primaryMembership.committee || null;
    }
    organizationIds = memberRes.rows.map((m) => m.organization_id);

    hasActiveOrg = activeMemberships.length > 0 || organizationRoles.length > 0;
    if (hasActiveOrg && effectivePrimaryRole !== 'ADMIN' && effectivePrimaryRole !== 'ADVISER' && !roles.includes('OFFICER')) {
      roles.push('OFFICER');
    }
  }

  let advisedOrganizations = [];
  if (row.adviser_db_id) {
    const advRes = await db.query(
      `SELECT oa.organization_id, o.name AS organization_name, o.acronym AS organization_acronym
         FROM organization_advisers oa
         JOIN organizations o ON o.id = oa.organization_id
        WHERE oa.adviser_id = $1 AND oa.ended_at IS NULL
        ORDER BY oa.assigned_at DESC`,
      [row.adviser_db_id]
    );
    if (advRes.rows.length > 0) {
      organizationId = advRes.rows[0].organization_id;
      organizationName = advRes.rows[0].organization_name;
      organizationIds = advRes.rows.map((a) => a.organization_id);
      advisedOrganizations = advRes.rows.map((a) => ({
        organization_id: a.organization_id,
        organizationId: a.organization_id,
        organization_name: a.organization_name,
        organizationName: a.organization_name,
        organization_acronym: a.organization_acronym,
        organizationAcronym: a.organization_acronym,
      }));
      organizationRoles = advRes.rows.map((a) => ({
        organizationId: a.organization_id,
        organizationName: a.organization_name,
        organizationAcronym: a.organization_acronym,
        positions: ['ADVISER'],
      }));
    }
  }

  const collegeId = row.student_college_id || row.adviser_college_id || null;
  const collegeName = row.student_college_name || row.adviser_college_name || null;
  const collegeAcronym = row.student_college_acronym || row.adviser_college_acronym || null;

  return {
    id: row.id,
    user_id: row.id,
    userId: row.student_number || row.employee_number || String(row.id),
    email: row.email,
    first_name: row.first_name,
    middle_name: row.middle_name || null,
    last_name: row.last_name,
    suffix: row.suffix || null,
    firstName: row.first_name,
    middleName: row.middle_name || null,
    lastName: row.last_name,
    displayName: `${row.last_name}, ${row.first_name}${row.middle_name ? ` ${row.middle_name}` : ''}${row.suffix ? ` ${row.suffix}` : ''}`,
    name: `${row.last_name}, ${row.first_name}${row.middle_name ? ` ${row.middle_name}` : ''}${row.suffix ? ` ${row.suffix}` : ''}`,
    role: effectivePrimaryRole,
    roles,
    isCoordinator,
    isGlobalAdmin: effectivePrimaryRole === 'ADMIN',
    status: row.status,
    student_id: row.student_db_id || null,
    studentDbId: row.student_db_id || null,
    studentRecordId: row.student_db_id || null,
    studentId: row.student_number || null,
    student_number: row.student_number || null,
    corFileName: row.cor_file_name || null,
    hasCor: Boolean(row.cor_file_name || row.has_cor),
    adviser_id: row.adviser_db_id || null,
    adviserDbId: row.adviser_db_id || null,
    adviserRecordId: row.adviser_db_id || null,
    employeeNumber: row.employee_number || null,
    employee_number: row.employee_number || null,
    programId: row.program_id || null,
    program: row.program_acronym || row.program_name || null,
    programName: row.program_name || null,
    programAcronym: row.program_acronym || null,
    departmentId: row.department_id || null,
    department: row.department_name || null,
    departmentAcronym: row.department_acronym || null,
    collegeId,
    college: collegeName,
    collegeAcronym,
    year_level: row.year_level || null,
    yearLevelNumber: row.year_level || null,
    yearLevel: formatYearLevelLabel(row.year_level),
    organizationId,
    organizationIds,
    organizationName,
    position,
    customTitle,
    committee,
    organizationRoles,
    memberships: allMemberships,
    advisedOrganizations,
    advised_organizations: advisedOrganizations,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// GET /api/users — List all users with joined student, adviser, academic, and organization details
router.get('/', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT u.id, u.email, u.first_name, u.middle_name, u.last_name, u.suffix,
              CASE
                WHEN u.role = 'ADMIN' THEN 'ADMIN'::user_role
                WHEN u.role = 'ADVISER' THEN 'ADVISER'::user_role
                ELSE 'OFFICER'::user_role
              END AS role,
              u.status, u.created_at, u.updated_at,
              s.id AS student_db_id, s.student_number, s.program_id, s.year_level, s.cor_file_name,
              (s.cor_file_data IS NOT NULL AND s.cor_file_data != '') AS has_cor,
              p.name AS program_name, p.acronym AS program_acronym,
              d.id AS department_id, d.name AS department_name, d.acronym AS department_acronym,
              c.id AS student_college_id, c.name AS student_college_name, c.acronym AS student_college_acronym,
              a.id AS adviser_db_id, a.employee_number, a.is_coordinator, a.college_id AS adviser_college_id,
              ac.name AS adviser_college_name, ac.acronym AS adviser_college_acronym,
              COALESCE(
                (SELECT string_agg(
                  o.name || ' (' || CASE
                    WHEN om.custom_title IS NOT NULL AND om.custom_title != '' THEN om.custom_title
                    WHEN om.position = 'PRESIDENT' THEN 'President'
                    WHEN om.position = 'VICE_PRESIDENT' THEN 'Vice President'
                    WHEN om.position = 'SECRETARY' THEN 'Secretary'
                    WHEN om.position = 'TREASURER' THEN 'Treasurer'
                    WHEN om.position = 'AUDITOR' THEN 'Auditor'
                    WHEN om.position = 'PRO' THEN 'Public Relations Officer'
                    WHEN om.position = 'MEMBER' THEN 'General Member'
                    ELSE initcap(replace(om.position::text, '_', ' '))
                  END || ')',
                  ', '
                )
                   FROM organization_members om
                   JOIN organizations o ON o.id = om.organization_id
                  WHERE om.student_id = s.id AND om.status = 'ACTIVE'),
                (SELECT string_agg(o.name || ' (Adviser)', ', ')
                   FROM organization_advisers oa
                   JOIN organizations o ON o.id = oa.organization_id
                  WHERE oa.adviser_id = a.id AND oa.ended_at IS NULL)
              ) AS organization_names
         FROM users u
    LEFT JOIN students s ON s.user_id = u.id
    LEFT JOIN programs p ON p.id = s.program_id
    LEFT JOIN departments d ON d.id = p.department_id
    LEFT JOIN colleges c ON c.id = d.college_id
    LEFT JOIN advisers a ON a.user_id = u.id
    LEFT JOIN colleges ac ON ac.id = a.college_id
        ORDER BY u.id ASC`
    );

    const rows = result.rows.map((r) => ({
      id: r.id,
      userId: r.student_number || r.employee_number || String(r.id),
      email: r.email,
      first_name: r.first_name,
      middle_name: r.middle_name || null,
      last_name: r.last_name,
      suffix: r.suffix || null,
      firstName: r.first_name,
      middleName: r.middle_name || null,
      lastName: r.last_name,
      name: `${r.last_name}, ${r.first_name}${r.middle_name ? ` ${r.middle_name}` : ''}${r.suffix ? ` ${r.suffix}` : ''}`,
      displayName: `${r.last_name}, ${r.first_name}${r.middle_name ? ` ${r.middle_name}` : ''}${r.suffix ? ` ${r.suffix}` : ''}`,
      role: r.role,
      status: r.status,
      studentDbId: r.student_db_id || null,
      studentId: r.student_number || null,
      student_number: r.student_number || null,
      corFileName: r.cor_file_name || null,
      hasCor: Boolean(r.has_cor),
      adviserDbId: r.adviser_db_id || null,
      isCoordinator: Boolean(r.is_coordinator),
      employee_number: r.employee_number || null,
      programId: r.program_id || null,
      program: r.program_acronym || r.program_name || null,
      programName: r.program_name || null,
      departmentId: r.department_id || null,
      department: r.department_name || null,
      collegeId: r.student_college_id || r.adviser_college_id || null,
      college: r.student_college_name || r.adviser_college_name || null,
      year_level: r.year_level || null,
      yearLevel: formatYearLevelLabel(r.year_level),
      organization: r.organization_names || 'Unassigned',
      created_at: r.created_at,
      updated_at: r.updated_at,
    }));

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/users/password-reset-requests — List tracked password reset requests for Student Affairs Admin
router.get('/password-reset-requests', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT prr.*,
             u.first_name,
             u.last_name,
             u.role,
             u.status AS user_status,
             CASE WHEN u.id IS NOT NULL THEN (u.last_name || ', ' || u.first_name || COALESCE(' ' || u.suffix, '')) ELSE NULL END AS user_name,
             CASE WHEN ru.id IS NOT NULL THEN (ru.last_name || ', ' || ru.first_name || COALESCE(' ' || ru.suffix, '')) ELSE NULL END AS resolved_by_name
        FROM password_reset_requests prr
   LEFT JOIN users u ON u.id = prr.user_id
   LEFT JOIN users ru ON ru.id = prr.resolved_by
       ORDER BY CASE WHEN prr.status = 'PENDING' THEN 0 ELSE 1 END, prr.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/users/forgot-password — Submit tracked reset ticket or perform ID-verified self-service reset
router.post('/forgot-password', async (req, res) => {
  const client = await db.pool.connect();
  try {
    const {
      email,
      identifier,
      student_or_employee_id,
      studentOrEmployeeId,
      new_password,
      newPassword,
      mode,
      reason,
    } = req.body || {};

    const cleanEmail = String(email || identifier || '').trim().toLowerCase();
    const idCheck = String(student_or_employee_id || studentOrEmployeeId || '').trim();
    const nextPassword = String(new_password || newPassword || '');

    if (!cleanEmail || !cleanEmail.endsWith('@wmsu.edu.ph')) {
      return res.status(400).json({ error: 'Enter your valid WMSU email address ending in @wmsu.edu.ph.' });
    }

    const userRes = await client.query(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.status,
              s.student_number, a.employee_number
         FROM users u
    LEFT JOIN students s ON s.user_id = u.id
    LEFT JOIN advisers a ON a.user_id = u.id
        WHERE lower(u.email) = $1
        LIMIT 1`,
      [cleanEmail]
    );

    const matchedUser = userRes.rows[0] || null;

    if (mode === 'VERIFY_ID' || (idCheck && nextPassword)) {
      if (!idCheck) {
        return res.status(400).json({ error: 'Enter your Student Number or Employee Number to verify your identity.' });
      }
      if (!nextPassword || nextPassword.length < 6) {
        return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
      }
      const idMatches =
        matchedUser &&
        ((matchedUser.student_number && String(matchedUser.student_number).trim().toLowerCase() === idCheck.toLowerCase()) ||
          (matchedUser.employee_number && String(matchedUser.employee_number).trim().toLowerCase() === idCheck.toLowerCase()));

      if (!matchedUser || !idMatches) {
        return res.status(400).json({ error: 'WMSU email and Student/Employee ID did not match an active account.' });
      }

      const passwordHash = await bcrypt.hash(nextPassword, 10);
      await client.query('BEGIN');
      await client.query('UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1', [
        matchedUser.id,
        passwordHash,
      ]);
      const ticketRes = await client.query(
        `INSERT INTO password_reset_requests (user_id, email, requested_identifier, status, reason, resolved_by, review_remarks, resolved_at)
         VALUES ($1, $2, $3, 'COMPLETED', $4, $1, 'Verified via Student/Employee ID self-reset', now())
         RETURNING id`,
        [matchedUser.id, matchedUser.email, idCheck, String(reason || 'Self-service password reset').trim()]
      );
      await client.query(
        `UPDATE password_reset_requests
            SET status = 'COMPLETED', resolved_by = $2, review_remarks = 'Superseded by self-service ID verification reset', resolved_at = now()
          WHERE user_id = $1 AND status = 'PENDING'`,
        [matchedUser.id, matchedUser.id]
      );
      await client.query('COMMIT');

      await notifyUser(matchedUser.id, {
        type: 'SECURITY',
        title: 'Password Updated Successfully',
        message: 'Your UNIDOS account password was reset using Student/Employee ID verification. You can now sign in with your new password.',
      });
      await notifyAdmins({
        type: 'SECURITY',
        title: `Password Reset Completed: ${matchedUser.email}`,
        message: `${matchedUser.last_name}, ${matchedUser.first_name} completed an ID-verified self-service password reset.`,
      });
      await recordAuditLog({
        userId: matchedUser.id,
        action: 'PASSWORD_RESET_SELF',
        entity: 'users',
        entityId: matchedUser.id,
        metadata: {
          email: matchedUser.email,
          request_id: ticketRes.rows[0]?.id,
          description: `Completed ID-verified password reset for ${matchedUser.email}`,
        },
        req,
      });

      return res.json({
        ok: true,
        mode: 'RESET',
        requestId: ticketRes.rows[0]?.id,
        message: 'Password updated successfully. You may now sign in with your new password.',
      });
    }

    if (!matchedUser) {
      await recordAuditLog({
        userId: null,
        action: 'PASSWORD_RESET_UNMATCHED',
        entity: 'users',
        entityId: null,
        metadata: {
          email: cleanEmail,
          description: `Password reset requested for unrecognized email ${cleanEmail}`,
        },
        req,
      });
      return res.json({
        ok: true,
        mode: 'REQUESTED',
        requestId: null,
        message: 'If this WMSU email matches an account, a password reset ticket has been forwarded to Student Affairs.',
      });
    }

    const reqInsert = await client.query(
      `INSERT INTO password_reset_requests (user_id, email, requested_identifier, status, reason)
       VALUES ($1, $2, $3, 'PENDING', $4)
       RETURNING id, created_at`,
      [matchedUser.id, matchedUser.email, idCheck || null, String(reason || 'Forgot password assistance requested').trim()]
    );
    const ticket = reqInsert.rows[0];

    await notifyAdmins({
      type: 'SECURITY',
      title: `Password Reset Requested: ${matchedUser.last_name}, ${matchedUser.first_name}`,
      message: `${matchedUser.email} (${matchedUser.role}) submitted password reset ticket #${ticket.id}. Open Users & Advisers to reset their password.`,
    });
    await recordAuditLog({
      userId: matchedUser.id,
      action: 'PASSWORD_RESET_REQUESTED',
      entity: 'password_reset_requests',
      entityId: ticket.id,
      metadata: {
        email: matchedUser.email,
        user_id: matchedUser.id,
        description: `Submitted password reset ticket #${ticket.id} for ${matchedUser.email}`,
      },
      req,
    });

    res.status(201).json({
      ok: true,
      mode: 'REQUESTED',
      requestId: ticket.id,
      message: `Password reset ticket #PRR-${ticket.id} submitted to Student Affairs Admin for review.`,
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[FORGOT PASSWORD ERROR]', err);
    res.status(500).json({ error: 'Unable to process password reset request.' });
  } finally {
    client.release();
  }
});

// PUT /api/users/password-reset-requests/:reqId/reject — Reject/dismiss a pending password reset request
router.put('/password-reset-requests/:reqId/reject', async (req, res) => {
  try {
    const reqId = resolvePositiveInt(req.params.reqId);
    if (!reqId) {
      return res.status(400).json({ error: 'Valid password reset request ID is required.' });
    }
    const { resolved_by, review_remarks } = req.body || {};
    const safeResolvedBy = resolvePositiveInt(resolved_by);
    const result = await db.query(
      `UPDATE password_reset_requests
          SET status = 'REJECTED',
              resolved_by = $2,
              review_remarks = $3,
              resolved_at = now()
        WHERE id = $1 AND status = 'PENDING'
        RETURNING *`,
      [reqId, safeResolvedBy, String(review_remarks || 'Closed by Student Affairs Admin').trim()]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Pending password reset request not found.' });
    }
    const row = result.rows[0];
    if (row.user_id) {
      await notifyUser(row.user_id, {
        type: 'SECURITY',
        title: `Password Reset Request #${row.id} Closed`,
        message: `Your password reset request #${row.id} was closed by Student Affairs.${review_remarks ? ` Note: ${review_remarks}` : ''}`,
      });
    }
    await recordAuditLog({
      userId: safeResolvedBy,
      action: 'REJECT_PASSWORD_RESET',
      entity: 'password_reset_requests',
      entityId: row.id,
      metadata: {
        email: row.email,
        review_remarks,
        description: `Rejected password reset request #${row.id} for ${row.email}`,
      },
      req,
    });
    res.json({ ok: true, request: row });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/users/:id/password — Admin password reset or authenticated self-service password change
router.put('/:id/password', async (req, res) => {
  const id = resolvePositiveInt(req.params.id);
  if (!id) {
    return res.status(400).json({ error: 'Valid user ID is required.' });
  }
  const client = await db.pool.connect();
  try {
    const {
      current_password,
      currentPassword,
      new_password,
      newPassword,
      updated_by,
      request_id,
      review_remarks,
      self_service,
    } = req.body || {};
    const safeUpdatedBy = resolvePositiveInt(updated_by);
    const safeRequestId = resolvePositiveInt(request_id);
    const currentPasswordValue = String(current_password ?? currentPassword ?? '');
    const isSelfService =
      Boolean(self_service) ||
      current_password !== undefined ||
      currentPassword !== undefined;
    const passwordValue = String(new_password || newPassword || '');
    if (!passwordValue || passwordValue.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
    }

    const userRes = await client.query(
      'SELECT id, email, first_name, last_name, password_hash FROM users WHERE id = $1',
      [id]
    );
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }
    const target = userRes.rows[0];

    if (isSelfService) {
      if (!currentPasswordValue) {
        return res.status(400).json({ error: 'Current password is required.' });
      }
      const matchesCurrent = target.password_hash
        ? await bcrypt.compare(currentPasswordValue, target.password_hash)
        : false;
      if (!matchesCurrent) {
        return res.status(401).json({ error: 'Current password is incorrect.' });
      }
      if (passwordValue === currentPasswordValue) {
        return res.status(400).json({ error: 'New password must be different from your current password.' });
      }
    }

    const hashed = await bcrypt.hash(passwordValue, 10);

    await client.query('BEGIN');
    await client.query('UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1', [id, hashed]);
    if (!isSelfService) {
      if (safeRequestId) {
        await client.query(
          `UPDATE password_reset_requests
              SET status = 'COMPLETED',
                  resolved_by = $2,
                  review_remarks = COALESCE($3, 'Password reset by Student Affairs Admin'),
                  resolved_at = now()
            WHERE id = $1`,
          [safeRequestId, safeUpdatedBy, review_remarks || null]
        );
      } else {
        await client.query(
          `UPDATE password_reset_requests
              SET status = 'COMPLETED',
                  resolved_by = $2,
                  review_remarks = COALESCE($3, 'Password reset by Student Affairs Admin'),
                  resolved_at = now()
            WHERE user_id = $1 AND status = 'PENDING'`,
          [id, safeUpdatedBy, review_remarks || null]
        );
      }
    }
    await client.query('COMMIT');

    await notifyUser(target.id, {
      type: 'SECURITY',
      title: isSelfService ? 'Account Password Updated' : 'Account Password Reset by Administration',
      message: isSelfService
        ? 'Your UNIDOS account password was changed. Contact Student Affairs immediately if you did not authorize this update.'
        : 'Your UNIDOS password was reset by Student Affairs Admin. Sign in with your updated credentials and keep them secure.',
    });
    await recordAuditLog({
      userId: safeUpdatedBy || target.id,
      action: isSelfService ? 'USER_CHANGE_PASSWORD' : 'ADMIN_RESET_PASSWORD',
      entity: 'users',
      entityId: target.id,
      metadata: {
        email: target.email,
        request_id: request_id || null,
        description: isSelfService
          ? `Changed account password for ${target.email}`
          : `Reset password for ${target.last_name}, ${target.first_name} (${target.email})`,
      },
      req,
    });

    res.json({
      ok: true,
      message: isSelfService
        ? 'Your account password has been updated.'
        : `Password updated for ${target.email}.`,
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

// GET /api/users/:id/cor — Retrieve stored student COR file bytes & filename
router.get('/:id/cor', async (req, res) => {
  try {
    const id = resolvePositiveInt(req.params.id);
    if (!id) {
      return res.status(400).json({ error: 'Valid user ID is required.' });
    }
    const result = await db.query(
      'SELECT s.id AS student_id, u.id AS user_id, s.cor_file_name, s.cor_file_data FROM users u JOIN students s ON s.user_id = u.id WHERE u.id = $1 OR s.id = $1 LIMIT 1',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'COR record not found.' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/users/:id — Get a single user profile by ID
router.get('/:id', async (req, res) => {
  try {
    const profile = await buildUserProfile(req.params.id);
    if (!profile) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(profile);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/users/register — Register a new user account with a bcrypt-hashed password
router.post('/register', async (req, res) => {
  try {
    const {
      email,
      password,
      role,
      first_name,
      firstName,
      middle_name,
      middleName,
      last_name,
      lastName,
      suffix,
      status,
      student_number,
      studentId,
      program_id,
      program,
      year_level,
      yearLevel,
      cor_file_name,
      corFileName,
      cor_file_data,
      corFileData,
      require_cor,
      organization_id,
      organizationId,
      position,
      custom_title,
      customTitle,
      committee,
      direct_enroll,
      directEnroll,
      employee_number,
      employeeNumber,
      college_id,
      collegeId,
    } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const cleanEmail = String(email).trim().toLowerCase();

    const fName = (first_name || firstName || email.split('@')[0]).trim();
    const lName = (last_name || lastName || 'User').trim();
    const mName = (middle_name || middleName || '').trim() || null;
    const sfx = (suffix || '').trim() || null;
    const rawRole = String(role || '').toUpperCase();
    const userRole = ['OFFICER', 'ADVISER', 'ADMIN'].includes(rawRole)
      ? rawRole
      : 'OFFICER';
    const userStatus = ['ACTIVE', 'SUSPENDED', 'PENDING'].includes(String(status || '').toUpperCase())
      ? String(status).toUpperCase()
      : 'ACTIVE';

    const stdNumber = String(student_number || studentId || '').trim();
    if (stdNumber && !/^\d+$/.test(stdNumber)) {
      return res.status(400).json({ error: 'Student ID must contain digits only.' });
    }

    const resolvedCorName = String(cor_file_name || corFileName || '').trim() || null;
    const resolvedCorData = cor_file_data || corFileData || null;
    if (require_cor && !resolvedCorName) {
      return res.status(400).json({ error: 'Certificate of Registration (COR) upload is required.' });
    }

    const saltRounds = 10;
    const password_hash = await bcrypt.hash(password, saltRounds);

    const userRes = await db.query(
      `INSERT INTO users (email, password_hash, first_name, middle_name, last_name, suffix, role, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [cleanEmail, password_hash, fName, mName, lName, sfx, userRole, userStatus]
    );

    const createdUserId = userRes.rows[0].id;

    // If officer/student academic profile info was supplied, create linked `students` record
    if (stdNumber || userRole === 'OFFICER') {
      const resolvedStdNum = stdNumber || String(20260000 + createdUserId);
      const progId = await resolveOrEnsureProgramId(program_id, program);
      const validYear = parseYearLevelNumber(year_level ?? yearLevel ?? 1);

      const stdInsert = await db.query(
        `INSERT INTO students (user_id, student_number, program_id, year_level, cor_file_name, cor_file_data)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (user_id) DO UPDATE
           SET student_number = EXCLUDED.student_number,
               program_id = EXCLUDED.program_id,
               year_level = EXCLUDED.year_level,
               cor_file_name = COALESCE(EXCLUDED.cor_file_name, students.cor_file_name),
               cor_file_data = COALESCE(EXCLUDED.cor_file_data, students.cor_file_data)
         RETURNING id`,
        [createdUserId, resolvedStdNum, progId, validYear, resolvedCorName, resolvedCorData]
      );

      const targetOrgId = resolvePositiveInt(organization_id || organizationId) || 0;
      if (targetOrgId > 0 && stdInsert.rows[0]?.id) {
        const studentDbId = stdInsert.rows[0].id;
        if (direct_enroll || directEnroll) {
          const validPos = ['PRESIDENT', 'VICE_PRESIDENT', 'SECRETARY', 'TREASURER', 'AUDITOR', 'PRO', 'OTHER_OFFICER', 'MEMBER'];
          const rawPos = String(position || 'OTHER_OFFICER').trim().toUpperCase().replace(/[\s.-]+/g, '_');
          const resolvedPos = rawPos === 'PIO' ? 'PRO' : (validPos.includes(rawPos) ? rawPos : 'OTHER_OFFICER');
          const resolvedCustomTitle = (custom_title || customTitle || '').trim() || (resolvedPos === 'OTHER_OFFICER' && position && !validPos.includes(rawPos) ? String(position).trim() : null);
          await db.query(
            `INSERT INTO organization_members (organization_id, student_id, position, custom_title, committee, status)
             VALUES ($1, $2, $3, $4, $5, 'ACTIVE')
             ON CONFLICT (organization_id, student_id)
             DO UPDATE SET position = EXCLUDED.position,
                           custom_title = EXCLUDED.custom_title,
                           committee = EXCLUDED.committee,
                           status = 'ACTIVE'`,
            [targetOrgId, studentDbId, resolvedPos, resolvedCustomTitle, committee || 'General Operations Committee']
          );
        } else {
          await db.query(
            `INSERT INTO organization_applications (organization_id, applicant_id, message, cor_file_name, cor_file_data, status)
             VALUES ($1, $2, $3, $4, $5, 'PENDING')
             ON CONFLICT (organization_id, applicant_id) WHERE status = 'PENDING'
             DO UPDATE SET cor_file_name = COALESCE(EXCLUDED.cor_file_name, organization_applications.cor_file_name),
                           cor_file_data = COALESCE(EXCLUDED.cor_file_data, organization_applications.cor_file_data)`,
            [
              targetOrgId,
              studentDbId,
              `Officer onboarding application${position ? ` (${position}${committee ? ` — ${committee}` : ''})` : ''}.`,
              resolvedCorName,
              resolvedCorData,
            ]
          ).catch(() => null);
        }
      }
    }

    // If adviser info was supplied (or role is ADVISER), create linked `advisers` record
    const empNumber = (employee_number || employeeNumber || '').trim();
    if (empNumber || userRole === 'ADVISER') {
      const resolvedEmpNum = empNumber || `ADV-${createdUserId}`;
      await db.query(
        `INSERT INTO advisers (user_id, employee_number, college_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id) DO UPDATE
           SET employee_number = EXCLUDED.employee_number,
               college_id = COALESCE(EXCLUDED.college_id, advisers.college_id)`,
        [createdUserId, resolvedEmpNum, resolvePositiveInt(college_id || collegeId)]
      );
    }

    const fullProfile = await buildUserProfile(createdUserId);

    // Record registration in audit logs
    await recordAuditLog({
      userId: createdUserId,
      action: 'USER_REGISTER',
      entity: 'users',
      entityId: createdUserId,
      metadata: {
        name: `${lName}, ${fName}`,
        email: cleanEmail,
        role: userRole,
        description: `New user account registered for ${fName} ${lName} (${cleanEmail}) with role ${userRole}.`,
      },
      req,
    });

    res.status(201).json(fullProfile);
  } catch (err) {
    console.error(err);
    if (err.code === '23505') {
      return res.status(409).json({ error: 'An account with this email or student/employee number already exists.' });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/users/login — Authenticate user by email, student number, or employee number
router.post('/login', async (req, res) => {
  try {
    const body = req.body || {};
    const rawIdentifier = body.identifier || body.email || '';
    const identifier = String(rawIdentifier).trim();
    const password = typeof body.password === 'string' ? body.password : String(body.password || '');

    console.log(`[LOGIN ATTEMPT] Identifier: "${identifier}", Password provided: ${Boolean(password)}`);

    if (!identifier || !password) {
      return res.status(400).json({ error: 'Email or ID, and password are required' });
    }

    const result = await db.query(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.suffix, u.password_hash, u.role, u.status
         FROM users u
    LEFT JOIN students s ON s.user_id = u.id
    LEFT JOIN advisers a ON a.user_id = u.id
        WHERE lower(trim(u.email)) = lower($1)
           OR lower(trim(COALESCE(s.student_number, ''))) = lower($1)
           OR lower(trim(COALESCE(a.employee_number, ''))) = lower($1)
        LIMIT 1`,
      [identifier]
    );

    if (result.rows.length === 0) {
      await recordAuditLog({
        userId: null,
        action: 'LOGIN_FAILED',
        entity: 'users',
        metadata: {
          identifier,
          reason: 'No account found with this email or ID',
          description: `Failed login attempt for identifier "${identifier}" (Account not found).`,
        },
        req,
      });
      return res.status(401).json({ error: 'No account found with this email or ID. Please check your credentials or register.' });
    }

    const user = result.rows[0];
    let isMatch = false;
    if (user.password_hash && user.password_hash.startsWith('$2')) {
      isMatch = await bcrypt.compare(password, user.password_hash);
    } else {
      isMatch = password === user.password_hash;
    }

    if (!isMatch) {
      await recordAuditLog({
        userId: user.id,
        action: 'LOGIN_FAILED',
        entity: 'users',
        entityId: user.id,
        metadata: {
          identifier,
          email: user.email,
          role: user.role,
          reason: 'Incorrect password',
          description: `Failed login attempt for ${user.email} (Incorrect password).`,
        },
        req,
      });
      return res.status(401).json({ error: 'Incorrect password. Please verify and try again.' });
    }

    if (user.status !== 'ACTIVE') {
      await recordAuditLog({
        userId: user.id,
        action: 'LOGIN_BLOCKED',
        entity: 'users',
        entityId: user.id,
        metadata: {
          email: user.email,
          role: user.role,
          status: user.status,
          description: `Login blocked for ${user.email}: account is ${user.status.toLowerCase()}.`,
        },
        req,
      });
      return res.status(403).json({ error: `This account is ${user.status.toLowerCase()}. Please contact Student Affairs.` });
    }

    const fullProfile = await buildUserProfile(user.id);
    if (!fullProfile) {
      return res.status(500).json({ error: 'Failed to construct user profile.' });
    }

    // Record successful login in audit logs
    const actorDisplayName = `${user.last_name}, ${user.first_name}${user.suffix ? ` ${user.suffix}` : ''}`;
    await recordAuditLog({
      userId: user.id,
      action: 'USER_LOGIN',
      entity: 'users',
      entityId: user.id,
      metadata: {
        name: actorDisplayName,
        email: user.email,
        role: user.role,
        description: `Signed in to the UNIDOS ${user.role} portal (${user.email}).`,
      },
      req,
    });

    res.json(fullProfile);
  } catch (err) {
    console.error('[LOGIN ERROR]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/users/logout — Record user sign-out
router.post('/logout', async (req, res) => {
  try {
    const { user_id } = req.body || {};
    if (user_id && Number.isFinite(Number(user_id))) {
      const uRes = await db.query('SELECT id, email, first_name, last_name, role FROM users WHERE id = $1', [user_id]);
      if (uRes.rows.length > 0) {
        const u = uRes.rows[0];
        await recordAuditLog({
          userId: u.id,
          action: 'USER_LOGOUT',
          entity: 'users',
          entityId: u.id,
          metadata: {
            email: u.email,
            role: u.role,
            description: `Signed out of the UNIDOS portal (${u.email}).`,
          },
          req,
        });
      }
    }
    res.json({ ok: true, message: 'Logged out successfully' });
  } catch (err) {
    console.error('[LOGOUT ERROR]', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/users/:id — Update user account details, role, status, and linked student/adviser profile
router.put('/:id', async (req, res) => {
  try {
    const id = resolvePositiveInt(req.params.id);
    if (!id) {
      return res.status(400).json({ error: 'Valid user ID is required.' });
    }
    const {
      email,
      first_name,
      firstName,
      middle_name,
      middleName,
      last_name,
      lastName,
      suffix,
      role,
      status,
      student_number,
      studentId,
      program_id,
      program,
      year_level,
      yearLevel,
      employee_number,
      employeeNumber,
      college_id,
      collegeId,
    } = req.body;

    const existingRes = await db.query('SELECT * FROM users WHERE id = $1', [id]);
    if (existingRes.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const current = existingRes.rows[0];

    const roleUpper = role ? String(role).toUpperCase() : current.role;
    const normalizedRole = roleUpper === 'STUDENT' ? 'OFFICER' : roleUpper;
    const validRole = ['OFFICER', 'ADVISER', 'ADMIN'].includes(normalizedRole)
      ? normalizedRole
      : (current.role === 'STUDENT' ? 'OFFICER' : current.role);

    // Map UI status 'INACTIVE' to 'PENDING' if passed, since user_status ENUM is ('ACTIVE', 'SUSPENDED', 'PENDING')
    let statusUpper = status ? String(status).toUpperCase() : current.status;
    if (statusUpper === 'INACTIVE') statusUpper = 'PENDING';
    const validStatus = ['ACTIVE', 'SUSPENDED', 'PENDING'].includes(statusUpper) ? statusUpper : current.status;

    await db.query(
      `UPDATE users
          SET email = $1,
              first_name = $2,
              middle_name = $3,
              last_name = $4,
              suffix = $5,
              role = $6,
              status = $7
        WHERE id = $8`,
      [
        (email || current.email).trim(),
        (first_name || firstName || current.first_name).trim(),
        middle_name !== undefined ? (middle_name ? middle_name.trim() : null) : middleName !== undefined ? (middleName ? middleName.trim() : null) : current.middle_name,
        (last_name || lastName || current.last_name).trim(),
        suffix !== undefined ? (suffix ? suffix.trim() : null) : current.suffix,
        validRole,
        validStatus,
        id,
      ]
    );

    // Sync organization_members position and status with role changes
    if (validRole === 'OFFICER') {
      const studentRes = await db.query('SELECT id FROM students WHERE user_id = $1', [id]);
      if (studentRes.rows.length > 0) {
        const studentId = studentRes.rows[0].id;
        const orgMem = await db.query(
          'SELECT id, organization_id, position, status FROM organization_members WHERE student_id = $1 ORDER BY id DESC LIMIT 1',
          [studentId]
        );
        if (orgMem.rows.length > 0) {
          const targetMem = orgMem.rows[0];
          const hasPres = await db.query(
            "SELECT id FROM organization_members WHERE organization_id = $1 AND position = 'PRESIDENT' AND status = 'ACTIVE' AND id != $2",
            [targetMem.organization_id, targetMem.id]
          );
          const defaultPos = hasPres.rows.length > 0 ? 'VICE_PRESIDENT' : 'PRESIDENT';
          await db.query(
            `UPDATE organization_members
                SET status = 'ACTIVE'::member_status,
                    left_at = NULL,
                    position = CASE WHEN position = 'MEMBER' THEN $2::member_position ELSE position END
              WHERE id = $1`,
            [targetMem.id, defaultPos]
          );
        }
      }
    } else if (validRole === 'STUDENT') {
      const studentRes = await db.query('SELECT id FROM students WHERE user_id = $1', [id]);
      if (studentRes.rows.length > 0) {
        const studentId = studentRes.rows[0].id;
        // Deactivate organization memberships so student does not reflect in any organization
        await db.query(
          "UPDATE organization_members SET status = 'INACTIVE'::member_status, position = 'MEMBER'::member_position, custom_title = NULL, left_at = now() WHERE student_id = $1",
          [studentId]
        );
        // Cancel approved applications so they no longer reflect as active approvals
        await db.query(
          "UPDATE organization_applications SET status = 'CANCELLED'::application_status WHERE applicant_id = $1 AND status = 'APPROVED'",
          [studentId]
        );
      }
    }

    if (student_number !== undefined || studentId !== undefined || program_id !== undefined || program !== undefined || year_level !== undefined || yearLevel !== undefined) {
      const rawStdNum = (student_number || studentId || '').trim();
      if (rawStdNum && !/^\d+$/.test(rawStdNum)) {
        return res.status(400).json({ error: 'Student ID must contain digits only.' });
      }
      const stdRes = await db.query('SELECT * FROM students WHERE user_id = $1', [id]);
      const progId = await resolveOrEnsureProgramId(program_id ?? stdRes.rows[0]?.program_id, program);
      const validYear = parseYearLevelNumber(year_level ?? yearLevel ?? stdRes.rows[0]?.year_level ?? 1);
      const resolvedStdNum = (rawStdNum || stdRes.rows[0]?.student_number || String(20260000 + Number(id))).trim();

      await db.query(
        `INSERT INTO students (user_id, student_number, program_id, year_level)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id) DO UPDATE
           SET student_number = EXCLUDED.student_number,
               program_id = EXCLUDED.program_id,
               year_level = EXCLUDED.year_level`,
        [id, resolvedStdNum, progId, validYear]
      );
    }

    if (validRole === 'ADVISER' || employee_number !== undefined || employeeNumber !== undefined || college_id !== undefined || collegeId !== undefined) {
      const advRes = await db.query('SELECT * FROM advisers WHERE user_id = $1', [id]);
      const resolvedEmpNum = (employee_number || employeeNumber || advRes.rows[0]?.employee_number || `ADV-${id}`).trim();
      const resolvedColId = resolvePositiveInt(college_id ?? collegeId) ?? advRes.rows[0]?.college_id ?? null;

      await db.query(
        `INSERT INTO advisers (user_id, employee_number, college_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id) DO UPDATE
           SET employee_number = EXCLUDED.employee_number,
               college_id = EXCLUDED.college_id`,
        [id, resolvedEmpNum, resolvedColId]
      );
    }

    const updatedProfile = await buildUserProfile(id);

    const changedRole = validRole !== current.role;
    const changedStatus = validStatus !== current.status;
    let updateDesc = `Updated account profile for ${updatedProfile?.name || updatedProfile?.email || `User #${id}`}`;
    if (changedRole && changedStatus) {
      updateDesc = `Updated ${updatedProfile?.name || updatedProfile?.email}: role changed from ${current.role} to ${validRole}, status changed from ${current.status} to ${validStatus}`;
    } else if (changedRole) {
      updateDesc = `Changed role of ${updatedProfile?.name || updatedProfile?.email} from ${current.role} to ${validRole}`;
    } else if (changedStatus) {
      updateDesc = `Changed status of ${updatedProfile?.name || updatedProfile?.email} from ${current.status} to ${validStatus}`;
    }

    await recordAuditLog({
      userId: resolvePositiveInt(req.body.updated_by || req.body.admin_id) || id,
      action: changedRole ? 'UPDATE_USER_ROLE' : (changedStatus ? 'UPDATE_USER_STATUS' : 'UPDATE_USER_PROFILE'),
      entity: 'users',
      entityId: id,
      metadata: {
        target_user_id: id,
        target_email: updatedProfile?.email,
        previous_role: current.role,
        new_role: validRole,
        previous_status: current.status,
        new_status: validStatus,
        description: updateDesc,
      },
      req,
    }).catch(() => null);

    res.json(updatedProfile);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'An account or student number with that value already exists.' });
    }
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.buildUserProfile = buildUserProfile;

module.exports = router;
