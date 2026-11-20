/**
 * Academic Structure Routes (backend/routes/academic.js)
 *
 * Links to `colleges`, `departments`, `programs`, `students`, and `advisers`
 * tables in ../database/student_org_db.sql.
 */
const express = require('express');
const router = express.Router();
const db = require('../db');
const { recordAuditLog } = require('../notificationsHelper');

function resolveActorId(req) {
  return resolvePositiveInt(req.body?.created_by || req.body?.user_id || req.query?.user_id);
}

function resolvePositiveInt(val) {
  if (val === undefined || val === null || String(val).trim() === '') return null;
  const num = Number(val);
  return Number.isInteger(num) && num > 0 ? num : null;
}

// GET /api/academic/hierarchy — Fetch colleges, departments, and programs in one call
router.get('/hierarchy', async (req, res) => {
  try {
    const [collegesRes, departmentsRes, programsRes] = await Promise.all([
      db.query('SELECT * FROM colleges ORDER BY name ASC'),
      db.query(`
        SELECT d.*, c.name AS college_name, c.acronym AS college_acronym
          FROM departments d
          JOIN colleges c ON c.id = d.college_id
         ORDER BY d.name ASC
      `),
      db.query(`
        SELECT p.*,
               d.name AS department_name,
               d.acronym AS department_acronym,
               c.name AS college_name,
               c.acronym AS college_acronym,
               c.id   AS college_id
          FROM programs p
          JOIN departments d ON d.id = p.department_id
          JOIN colleges c    ON c.id = d.college_id
         ORDER BY p.name ASC
      `),
    ]);
    res.json({
      colleges: collegesRes.rows,
      departments: departmentsRes.rows,
      programs: programsRes.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/academic/colleges — Fetch all colleges ordered alphabetically
router.get('/colleges', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM colleges ORDER BY name ASC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/academic/colleges — Create a new college (name and acronym must be unique)
router.post('/colleges', async (req, res) => {
  try {
    const { name, acronym } = req.body;
    if (!name || !acronym) {
      return res.status(400).json({ error: 'Name and acronym are required' });
    }
    const result = await db.query(
      'INSERT INTO colleges (name, acronym) VALUES ($1, $2) RETURNING *',
      [name.trim(), acronym.trim().toUpperCase()]
    );
    await recordAuditLog({
      userId: resolveActorId(req),
      action: 'CREATE_COLLEGE',
      entity: 'colleges',
      entityId: result.rows[0].id,
      metadata: { name: result.rows[0].name, acronym: result.rows[0].acronym, description: `Created college ${result.rows[0].acronym} (${result.rows[0].name})` },
      req,
    });
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    if (err.code === '23505') {
      return res.status(409).json({ error: 'College name or acronym already exists' });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/academic/colleges/:id — Delete a college if not referenced
router.delete('/colleges/:id', async (req, res) => {
  try {
    const id = resolvePositiveInt(req.params.id);
    if (!id) {
      return res.status(400).json({ error: 'Valid college ID is required.' });
    }
    const result = await db.query('DELETE FROM colleges WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'College not found.' });
    }
    await recordAuditLog({
      userId: resolveActorId(req),
      action: 'DELETE_COLLEGE',
      entity: 'colleges',
      entityId: id,
      metadata: { description: `Deleted college #${id}` },
      req,
    });
    res.json({ deleted: true });
  } catch (err) {
    console.error(err);
    if (err.code === '23503') {
      return res.status(409).json({ error: 'Cannot delete college while departments or organizations reference it.' });
    }
    res.status(400).json({ error: 'Cannot delete college while departments or organizations reference it.' });
  }
});

// GET /api/academic/departments — List departments, optionally filtered by college_id
router.get('/departments', async (req, res) => {
  try {
    const { college_id } = req.query;
    let queryText = `
      SELECT d.*, c.name AS college_name, c.acronym AS college_acronym
        FROM departments d
        JOIN colleges c ON c.id = d.college_id
    `;
    const params = [];

    if (college_id !== undefined && String(college_id).trim() !== '') {
      const collegeIdNum = resolvePositiveInt(college_id);
      if (!collegeIdNum) {
        return res.status(400).json({ error: 'Valid college_id is required.' });
      }
      queryText += ' WHERE d.college_id = $1';
      params.push(collegeIdNum);
    }
    queryText += ' ORDER BY d.name ASC';

    const result = await db.query(queryText, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/academic/departments — Create a new department under a college
router.post('/departments', async (req, res) => {
  try {
    const { college_id, name, acronym } = req.body;
    const collegeIdNum = resolvePositiveInt(college_id);
    if (!collegeIdNum || !name || !String(name).trim()) {
      return res.status(400).json({ error: 'Valid college_id and name are required' });
    }
    const result = await db.query(
      'INSERT INTO departments (college_id, name, acronym) VALUES ($1, $2, $3) RETURNING *',
      [collegeIdNum, name.trim(), acronym ? acronym.trim().toUpperCase() : null]
    );
    await recordAuditLog({
      userId: resolveActorId(req),
      action: 'CREATE_DEPARTMENT',
      entity: 'departments',
      entityId: result.rows[0].id,
      metadata: { college_id: collegeIdNum, name: result.rows[0].name, description: `Created department "${result.rows[0].name}"` },
      req,
    });
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    if (err.code === '23503') {
      return res.status(404).json({ error: 'Referenced college not found' });
    }
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Department already exists in this college' });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/academic/departments/:id — Delete a department if not referenced
router.delete('/departments/:id', async (req, res) => {
  try {
    const id = resolvePositiveInt(req.params.id);
    if (!id) {
      return res.status(400).json({ error: 'Valid department ID is required.' });
    }
    const result = await db.query('DELETE FROM departments WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Department not found.' });
    }
    await recordAuditLog({
      userId: resolveActorId(req),
      action: 'DELETE_DEPARTMENT',
      entity: 'departments',
      entityId: id,
      metadata: { description: `Deleted department #${id}` },
      req,
    });
    res.json({ deleted: true });
  } catch (err) {
    console.error(err);
    if (err.code === '23503') {
      return res.status(409).json({ error: 'Cannot delete department while programs or organizations reference it.' });
    }
    res.status(400).json({ error: 'Cannot delete department while programs or organizations reference it.' });
  }
});

// GET /api/academic/programs — List degree programs with department and college metadata
router.get('/programs', async (req, res) => {
  try {
    const { department_id } = req.query;
    let queryText = `
      SELECT p.*,
             d.name AS department_name,
             d.acronym AS department_acronym,
             c.name AS college_name,
             c.acronym AS college_acronym,
             c.id   AS college_id
        FROM programs p
        JOIN departments d ON d.id = p.department_id
        JOIN colleges c    ON c.id = d.college_id
    `;
    const params = [];

    if (department_id !== undefined && String(department_id).trim() !== '') {
      const deptIdNum = resolvePositiveInt(department_id);
      if (!deptIdNum) {
        return res.status(400).json({ error: 'Valid department_id is required.' });
      }
      queryText += ' WHERE p.department_id = $1';
      params.push(deptIdNum);
    }
    queryText += ' ORDER BY p.name ASC';

    const result = await db.query(queryText, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/academic/programs — Create a new academic program under a department
router.post('/programs', async (req, res) => {
  try {
    const { department_id, name, acronym } = req.body;
    const deptIdNum = resolvePositiveInt(department_id);
    if (!deptIdNum || !name || !String(name).trim() || !acronym || !String(acronym).trim()) {
      return res.status(400).json({ error: 'Valid department_id, name, and acronym are required' });
    }
    const result = await db.query(
      'INSERT INTO programs (department_id, name, acronym) VALUES ($1, $2, $3) RETURNING *',
      [deptIdNum, name.trim(), acronym.trim().toUpperCase()]
    );
    await recordAuditLog({
      userId: resolveActorId(req),
      action: 'CREATE_PROGRAM',
      entity: 'programs',
      entityId: result.rows[0].id,
      metadata: { department_id: deptIdNum, name: result.rows[0].name, acronym: result.rows[0].acronym, description: `Created program ${result.rows[0].acronym} (${result.rows[0].name})` },
      req,
    });
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    if (err.code === '23503') {
      return res.status(404).json({ error: 'Referenced department not found' });
    }
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Program name or acronym already exists' });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/academic/programs/:id — Delete a program if not referenced
router.delete('/programs/:id', async (req, res) => {
  try {
    const id = resolvePositiveInt(req.params.id);
    if (!id) {
      return res.status(400).json({ error: 'Valid program ID is required.' });
    }
    const result = await db.query('DELETE FROM programs WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Program not found.' });
    }
    await recordAuditLog({
      userId: resolveActorId(req),
      action: 'DELETE_PROGRAM',
      entity: 'programs',
      entityId: id,
      metadata: { description: `Deleted program #${id}` },
      req,
    });
    res.json({ deleted: true });
  } catch (err) {
    console.error(err);
    if (err.code === '23503') {
      return res.status(409).json({ error: 'Cannot delete program while students reference it.' });
    }
    res.status(400).json({ error: 'Cannot delete program while students reference it.' });
  }
});

// GET /api/academic/students — Fetch all student profiles joined with user and academic info
router.get('/students', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT s.id,
             s.user_id,
             s.student_number,
             s.program_id,
             s.year_level,
             u.email,
             u.first_name,
             u.middle_name,
             u.last_name,
             u.suffix,
             u.role,
             u.status AS user_status,
             p.name   AS program_name,
             p.acronym AS program_acronym,
             d.id     AS department_id,
             d.name   AS department_name,
             d.acronym AS department_acronym,
             c.name   AS college_name,
             c.acronym AS college_acronym,
             c.id     AS college_id
        FROM students s
        JOIN users u       ON u.id = s.user_id
        JOIN programs p    ON p.id = s.program_id
        JOIN departments d ON d.id = p.department_id
        JOIN colleges c    ON c.id = d.college_id
       ORDER BY u.last_name ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/academic/students/:id — Fetch a single student profile by student.id or user_id
router.get('/students/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      `SELECT s.id,
              s.user_id,
              s.student_number,
              s.program_id,
              s.year_level,
              u.email,
              u.first_name,
              u.last_name,
              p.name   AS program_name,
              p.acronym AS program_acronym,
              d.id     AS department_id,
              d.name   AS department_name,
              c.name   AS college_name,
              c.id     AS college_id
         FROM students s
         JOIN users u       ON u.id = s.user_id
         JOIN programs p    ON p.id = s.program_id
         JOIN departments d ON d.id = p.department_id
         JOIN colleges c    ON c.id = d.college_id
        WHERE s.id = $1 OR s.user_id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/academic/students — Create a student record linked to a user and program
router.post('/students', async (req, res) => {
  try {
    const { user_id, student_number, program_id, year_level } = req.body;
    if (!user_id || !student_number || !program_id || !year_level) {
      return res.status(400).json({
        error: 'user_id, student_number, program_id, and year_level are required',
      });
    }

    const cleanStudentNumber = String(student_number).trim();
    if (!/^\d+$/.test(cleanStudentNumber)) {
      return res.status(400).json({ error: 'student_number must contain digits only (0-9)' });
    }

    const yearLevelNum = Number(year_level);
    // Matches CHECK (year_level BETWEEN 1 AND 6) in database/student_org_db.sql
    if (!Number.isInteger(yearLevelNum) || yearLevelNum < 1 || yearLevelNum > 6) {
      return res.status(400).json({ error: 'year_level must be an integer between 1 and 6' });
    }

    const result = await db.query(
      `INSERT INTO students (user_id, student_number, program_id, year_level)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [user_id, cleanStudentNumber, program_id, yearLevelNum]
    );
    await recordAuditLog({
      userId: resolveActorId(req) || user_id,
      action: 'CREATE_STUDENT_PROFILE',
      entity: 'students',
      entityId: result.rows[0].id,
      metadata: { student_number: cleanStudentNumber, program_id, year_level, description: `Created student record ${cleanStudentNumber}` },
      req,
    });
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Student profile or student number already exists' });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/academic/advisers — Fetch all faculty adviser profiles joined with user and college info
router.get('/advisers', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT a.id,
             a.user_id,
             a.employee_number,
             a.college_id,
             u.email,
             u.first_name,
             u.middle_name,
             u.last_name,
             u.suffix,
             c.name AS college_name,
             c.acronym AS college_acronym
        FROM advisers a
        JOIN users u ON u.id = a.user_id
   LEFT JOIN colleges c ON c.id = a.college_id
       ORDER BY u.last_name ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/academic/advisers — Create a faculty adviser profile linked to a user
router.post('/advisers', async (req, res) => {
  try {
    const { user_id, employee_number, college_id } = req.body;
    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    const result = await db.query(
      `INSERT INTO advisers (user_id, employee_number, college_id)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [user_id, employee_number ? employee_number.trim() : null, college_id || null]
    );
    await recordAuditLog({
      userId: resolveActorId(req) || user_id,
      action: 'CREATE_ADVISER_PROFILE',
      entity: 'advisers',
      entityId: result.rows[0].id,
      metadata: { user_id, employee_number, college_id, description: `Created adviser profile #${result.rows[0].id}` },
      req,
    });
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Adviser profile or employee number already exists' });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
