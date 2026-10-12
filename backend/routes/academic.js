const express = require('express');
const router = express.Router();
const db = require('../db');

// ============================================================
// COLLEGES
// ============================================================

router.get('/colleges', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM colleges ORDER BY name ASC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/colleges', async (req, res) => {
  try {
    const { name, acronym } = req.body;
    if (!name || !acronym) {
      return res.status(400).json({ error: 'Name and acronym are required' });
    }
    const result = await db.query(
      'INSERT INTO colleges (name, acronym) VALUES ($1, $2) RETURNING *',
      [name.trim(), acronym.trim()]
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

// ============================================================
// DEPARTMENTS
// ============================================================

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

router.post('/departments', async (req, res) => {
  try {
    const { college_id, name, acronym } = req.body;
    if (!college_id || !name) {
      return res.status(400).json({ error: 'college_id and name are required' });
    }
    const result = await db.query(
      'INSERT INTO departments (college_id, name, acronym) VALUES ($1, $2, $3) RETURNING *',
      [college_id, name.trim(), acronym ? acronym.trim() : null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================================
// PROGRAMS
// ============================================================

router.get('/programs', async (req, res) => {
  try {
    const { department_id } = req.query;
    let queryText = `
      SELECT p.*,
             d.name AS department_name,
             c.name AS college_name,
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

router.post('/programs', async (req, res) => {
  try {
    const { department_id, name, acronym } = req.body;
    if (!department_id || !name || !acronym) {
      return res.status(400).json({ error: 'department_id, name, and acronym are required' });
    }
    const result = await db.query(
      'INSERT INTO programs (department_id, name, acronym) VALUES ($1, $2, $3) RETURNING *',
      [department_id, name.trim(), acronym.trim()]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================================
// STUDENTS
// ============================================================

router.get('/students', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT s.id,
             s.user_id,
             s.student_number,
             s.year_level,
             u.email,
             u.first_name,
             u.last_name,
             u.role,
             u.status AS user_status,
             p.name   AS program_name,
             p.acronym AS program_acronym,
             d.name   AS department_name,
             c.name   AS college_name,
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

router.get('/students/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      `SELECT s.id,
              s.user_id,
              s.student_number,
              s.year_level,
              u.email,
              u.first_name,
              u.last_name,
              p.name   AS program_name,
              p.acronym AS program_acronym,
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

router.post('/students', async (req, res) => {
  try {
    const { user_id, student_number, program_id, year_level } = req.body;
    if (!user_id || !student_number || !program_id || !year_level) {
      return res.status(400).json({
        error: 'user_id, student_number, program_id, and year_level are required',
      });
    }

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

// ============================================================
// ADVISERS
// ============================================================

router.get('/advisers', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT a.id,
             a.user_id,
             a.employee_number,
             a.college_id,
             u.email,
             u.first_name,
             u.last_name,
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
