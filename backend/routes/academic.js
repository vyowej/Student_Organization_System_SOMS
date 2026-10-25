/**
 * Academic Structure Routes (backend/routes/academic.js)
 *
 * Links to `colleges`, `departments`, `programs`, `students`, and `advisers`
 * tables in ../database/student_org_db.sql.
 */
const express = require('express');
const router = express.Router();
const db = require('../db');

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
    await db.query('DELETE FROM colleges WHERE id = $1', [req.params.id]);
    res.json({ deleted: true });
  } catch (err) {
    console.error(err);
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

    if (college_id) {
      queryText += ' WHERE d.college_id = $1';
      params.push(college_id);
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
    if (!college_id || !name) {
      return res.status(400).json({ error: 'college_id and name are required' });
    }
    const result = await db.query(
      'INSERT INTO departments (college_id, name, acronym) VALUES ($1, $2, $3) RETURNING *',
      [college_id, name.trim(), acronym ? acronym.trim().toUpperCase() : null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Department already exists in this college' });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/academic/departments/:id — Delete a department if not referenced
router.delete('/departments/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM departments WHERE id = $1', [req.params.id]);
    res.json({ deleted: true });
  } catch (err) {
    console.error(err);
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

    if (department_id) {
      queryText += ' WHERE p.department_id = $1';
      params.push(department_id);
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
    if (!department_id || !name || !acronym) {
      return res.status(400).json({ error: 'department_id, name, and acronym are required' });
    }
    const result = await db.query(
      'INSERT INTO programs (department_id, name, acronym) VALUES ($1, $2, $3) RETURNING *',
      [department_id, name.trim(), acronym.trim().toUpperCase()]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Program name or acronym already exists' });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/academic/programs/:id — Delete a program if not referenced
router.delete('/programs/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM programs WHERE id = $1', [req.params.id]);
    res.json({ deleted: true });
  } catch (err) {
    console.error(err);
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

    // Matches CHECK (year_level BETWEEN 1 AND 6) in database/student_org_db.sql
    if (year_level < 1 || year_level > 6) {
      return res.status(400).json({ error: 'year_level must be between 1 and 6' });
    }

    const result = await db.query(
      `INSERT INTO students (user_id, student_number, program_id, year_level)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [user_id, student_number.trim(), program_id, year_level]
    );
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
