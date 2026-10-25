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
    const found = await db.query(
      'SELECT id FROM programs WHERE lower(acronym) = lower($1) OR lower(name) = lower($1) LIMIT 1',
      [label]
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
    `SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.status, u.created_at, u.updated_at,
            s.id AS student_db_id, s.student_number, s.program_id, s.year_level,
            p.name AS program_name, p.acronym AS program_acronym,
            d.id AS department_id, d.name AS department_name, d.acronym AS department_acronym,
            c.id AS student_college_id, c.name AS student_college_name, c.acronym AS student_college_acronym,
            a.id AS adviser_db_id, a.employee_number, a.college_id AS adviser_college_id,
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

  const roles = [row.role];
  if (row.role === 'OFFICER' && !roles.includes('STUDENT')) {
    roles.unshift('STUDENT');
  }

  let organizationRoles = [];
  let organizationIds = [];
  let organizationId = null;
  let organizationName = null;
  let position = null;
  let customTitle = null;
  let allMemberships = [];

  if (row.student_db_id) {
    const memberRes = await db.query(
      `SELECT om.id, om.organization_id, om.position, om.custom_title, om.status,
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
      position: m.custom_title || (m.position === 'MEMBER' ? 'Officer' : m.position),
      customTitle: m.custom_title,
      positions: [m.custom_title || (m.position === 'MEMBER' ? 'Officer' : m.position)],
    }));

    allMemberships = memberRes.rows.map((m) => ({
      organizationId: m.organization_id,
      organizationName: m.organization_name,
      organizationAcronym: m.organization_acronym,
      position: m.position,
      customTitle: m.custom_title,
      positions: [m.custom_title || m.position],
      status: m.status,
    }));

    const primaryMembership = effectiveMemberships[0] || memberRes.rows[0] || null;
    if (primaryMembership) {
      organizationId = primaryMembership.organization_id;
      organizationName = primaryMembership.organization_name;
      position = primaryMembership.position;
      customTitle = primaryMembership.custom_title;
    }
    organizationIds = memberRes.rows.map((m) => m.organization_id);

    if (activeMemberships.length > 0) {
      if (!roles.includes('OFFICER')) roles.push('OFFICER');
      if (!roles.includes('STUDENT')) roles.unshift('STUDENT');
    } else {
      const offIdx = roles.indexOf('OFFICER');
      if (offIdx !== -1) roles.splice(offIdx, 1);
      if (!roles.includes('STUDENT') && row.role !== 'ADMIN' && row.role !== 'ADVISER') {
        roles.push('STUDENT');
      }
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
    last_name: row.last_name,
    firstName: row.first_name,
    lastName: row.last_name,
    displayName: `${row.last_name}, ${row.first_name}`,
    name: `${row.last_name}, ${row.first_name}`,
    role: (roles.includes('OFFICER') && row.role !== 'ADMIN' && row.role !== 'ADVISER') ? 'OFFICER' : row.role,
    roles,
    status: row.status,
    student_id: row.student_db_id || null,
    studentDbId: row.student_db_id || null,
    studentRecordId: row.student_db_id || null,
    studentId: row.student_number || null,
    student_number: row.student_number || null,
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
      `SELECT u.id, u.email, u.first_name, u.last_name,
              CASE
                WHEN u.role = 'ADMIN' THEN 'ADMIN'::user_role
                WHEN u.role = 'ADVISER' THEN 'ADVISER'::user_role
                WHEN EXISTS (
                  SELECT 1 FROM organization_members om
                   WHERE om.student_id = s.id AND om.status = 'ACTIVE'
                ) THEN 'OFFICER'::user_role
                ELSE u.role
              END AS role,
              u.status, u.created_at, u.updated_at,
              s.id AS student_db_id, s.student_number, s.program_id, s.year_level,
              p.name AS program_name, p.acronym AS program_acronym,
              d.id AS department_id, d.name AS department_name, d.acronym AS department_acronym,
              c.id AS student_college_id, c.name AS student_college_name, c.acronym AS student_college_acronym,
              a.id AS adviser_db_id, a.employee_number, a.college_id AS adviser_college_id,
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
      last_name: r.last_name,
      firstName: r.first_name,
      lastName: r.last_name,
      name: `${r.last_name}, ${r.first_name}`,
      displayName: `${r.last_name}, ${r.first_name}`,
      role: r.role,
      status: r.status,
      studentDbId: r.student_db_id || null,
      studentId: r.student_number || null,
      student_number: r.student_number || null,
      adviserDbId: r.adviser_db_id || null,
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
      last_name,
      lastName,
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

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const fName = (first_name || firstName || email.split('@')[0]).trim();
    const lName = (last_name || lastName || 'User').trim();
    const userRole = ['STUDENT', 'OFFICER', 'ADVISER', 'ADMIN'].includes(String(role || '').toUpperCase())
      ? String(role).toUpperCase()
      : 'STUDENT';
    const userStatus = ['ACTIVE', 'SUSPENDED', 'PENDING'].includes(String(status || '').toUpperCase())
      ? String(status).toUpperCase()
      : 'ACTIVE';

    const saltRounds = 10;
    const password_hash = await bcrypt.hash(password, saltRounds);

    const userRes = await db.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, role, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [email.trim(), password_hash, fName, lName, userRole, userStatus]
    );

    const createdUserId = userRes.rows[0].id;

    // If student info was supplied (or role is STUDENT/OFFICER), create linked `students` record
    const stdNumber = (student_number || studentId || '').trim();
    if (stdNumber || userRole === 'STUDENT' || userRole === 'OFFICER') {
      const resolvedStdNum = stdNumber || `STD-${createdUserId}`;
      const progId = await resolveOrEnsureProgramId(program_id, program);
      const validYear = parseYearLevelNumber(year_level ?? yearLevel ?? 1);

      await db.query(
        `INSERT INTO students (user_id, student_number, program_id, year_level)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id) DO UPDATE
           SET student_number = EXCLUDED.student_number,
               program_id = EXCLUDED.program_id,
               year_level = EXCLUDED.year_level`,
        [createdUserId, resolvedStdNum, progId, validYear]
      );
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
        [createdUserId, resolvedEmpNum, college_id || collegeId || null]
      );
    }

    const fullProfile = await buildUserProfile(createdUserId);
    res.status(201).json(fullProfile);
  } catch (err) {
    console.error(err);
    if (err.code === '23505') {
      return res.status(409).json({ error: 'An account with this email or student/employee number already exists.' });
    }
    res.status(500).json({ error: err.message || 'Server error' });
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
      `SELECT u.id, u.email, u.first_name, u.last_name, u.password_hash, u.role, u.status
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
      return res.status(401).json({ error: 'Incorrect password. Please verify and try again.' });
    }

    if (user.status !== 'ACTIVE') {
      return res.status(403).json({ error: `This account is ${user.status.toLowerCase()}. Please contact Student Affairs.` });
    }

    const fullProfile = await buildUserProfile(user.id);
    if (!fullProfile) {
      return res.status(500).json({ error: 'Failed to construct user profile.' });
    }
    res.json(fullProfile);
  } catch (err) {
    console.error('[LOGIN ERROR]', err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

// PUT /api/users/:id — Update user account details, role, status, and linked student/adviser profile
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      email,
      first_name,
      firstName,
      last_name,
      lastName,
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
    const validRole = ['STUDENT', 'OFFICER', 'ADVISER', 'ADMIN'].includes(roleUpper) ? roleUpper : current.role;

    // Map UI status 'INACTIVE' to 'PENDING' if passed, since user_status ENUM is ('ACTIVE', 'SUSPENDED', 'PENDING')
    let statusUpper = status ? String(status).toUpperCase() : current.status;
    if (statusUpper === 'INACTIVE') statusUpper = 'PENDING';
    const validStatus = ['ACTIVE', 'SUSPENDED', 'PENDING'].includes(statusUpper) ? statusUpper : current.status;

    await db.query(
      `UPDATE users
          SET email = $1,
              first_name = $2,
              last_name = $3,
              role = $4,
              status = $5
        WHERE id = $6`,
      [
        (email || current.email).trim(),
        (first_name || firstName || current.first_name).trim(),
        (last_name || lastName || current.last_name).trim(),
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
      const stdRes = await db.query('SELECT * FROM students WHERE user_id = $1', [id]);
      const progId = await resolveOrEnsureProgramId(program_id ?? stdRes.rows[0]?.program_id, program);
      const validYear = parseYearLevelNumber(year_level ?? yearLevel ?? stdRes.rows[0]?.year_level ?? 1);
      const resolvedStdNum = (student_number || studentId || stdRes.rows[0]?.student_number || `STD-${id}`).trim();

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
      const resolvedColId = college_id ?? collegeId ?? advRes.rows[0]?.college_id ?? null;

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
    res.json(updatedProfile);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

module.exports = router;
