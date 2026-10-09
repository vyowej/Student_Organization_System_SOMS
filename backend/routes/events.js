const express = require('express');
const router = express.Router();
const db = require('../db');

// DATA RELATED: Fetch all published events for student calendar
router.get('/', async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM events WHERE status = 'PUBLISHED'");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// USER RELATED: Officers propose a new event
router.post('/', async (req, res) => {
  try {
    const { organization_id, title, description, location, start_date, end_date, created_by } = req.body;
    const result = await db.query(
      'INSERT INTO events (organization_id, title, description, location, start_date, end_date, created_by, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [organization_id, title, description, location, start_date, end_date, created_by, 'DRAFT'] // Starts as draft before approval
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
