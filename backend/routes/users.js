const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const db = require('../db');

// ADMIN RELATED: Get all users
router.get('/', async (req, res) => {
  try {
    const result = await db.query('SELECT id, email, role, status, created_at FROM users');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// USER RELATED: Register (Sign up) a new user
router.post('/register', async (req, res) => {
  try {
    const { email, password, role } = req.body;
    // ADMIN RELATED: Users start as STUDENT by default, unless specified
    const userRole = role || 'STUDENT';
    
    // DATA RELATED: Hash the password using bcrypt
    const saltRounds = 10;
    const password_hash = await bcrypt.hash(password, saltRounds);

    const result = await db.query(
      'INSERT INTO users (email, password_hash, role, status) VALUES ($1, $2, $3, $4) RETURNING id, email, role, status',
      [email, password_hash, userRole, 'ACTIVE']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// USER RELATED: Login (Sign in) user
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // DATA RELATED: Check if the user exists
    const result = await db.query(
      'SELECT id, email, password_hash, role, status FROM users WHERE email = $1',
      [email]
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
      role: user.role,
      status: user.status
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
