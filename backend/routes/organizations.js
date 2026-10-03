const express = require('express');
const router = express.Router();
const db = require('../db');

// DATA RELATED: Get all active organizations for students to view
router.get('/', async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM organizations WHERE status = 'ACTIVE'");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ADMIN RELATED: Create or accredit a new organization
router.post('/', async (req, res) => {
  try {
    const { name, acronym, description, adviser_id } = req.body;
    const result = await db.query(
      'INSERT INTO organizations (name, acronym, description, adviser_id, status) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [name, acronym, description, adviser_id, 'PENDING'] // PENDING until admin approves
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ADMIN RELATED: Approve an organization
router.put('/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      "UPDATE organizations SET status = 'ACTIVE' WHERE id = $1 RETURNING *",
      [id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
