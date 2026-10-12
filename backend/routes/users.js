const express = require('express');
const router = express.Router();
let bcrypt;
try {
  bcrypt = require('bcrypt');
} catch {
  bcrypt = require('bcryptjs');
}
const db = require('../db');


// ADMIN RELATED: Get all users
router.get('/', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, email, first_name, last_name, role, status, created_at FROM users ORDER BY id ASC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// USER RELATED: Register (Sign up) a new user
router.post('/register', async (req, res) => {
  try {
    const { email, password, role, first_name, last_name, status } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // student_org_db schema requires first_name and last_name (NOT NULL)
    const firstName = first_name || email.split('@')[0];
    const lastName = last_name || 'Member';
    const userRole = role || 'STUDENT';
    const userStatus = status || 'ACTIVE';

    // DATA RELATED: Hash the password using bcrypt
    const saltRounds = 10;
    const password_hash = await bcrypt.hash(password, saltRounds);

    const result = await db.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, role, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, email, first_name, last_name, role, status, created_at`,
      [email.trim(), password_hash, firstName.trim(), lastName.trim(), userRole, userStatus]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A user with this email already exists' });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

// USER RELATED: Login (Sign in) user
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // DATA RELATED: Check if the user exists (case-insensitive email)
    const result = await db.query(
      'SELECT id, email, first_name, last_name, password_hash, role, status FROM users WHERE lower(email) = lower($1)',
      [email.trim()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    // DATA RELATED: Compare the password with the hashed password in the DB
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Send back user data (excluding password_hash)
    res.json({
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role,
      status: user.status,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

