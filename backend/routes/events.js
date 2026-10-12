const express = require('express');
const router = express.Router();
const db = require('../db');

// DATA RELATED: Fetch all published events for student calendar (with organization details)
router.get('/', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT e.*,
             o.name as organization_name,
             o.acronym as organization_acronym
        FROM events e
        JOIN organizations o ON o.id = e.organization_id
       WHERE e.status = 'PUBLISHED'
       ORDER BY e.start_date ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// USER RELATED: Officers propose a new event
router.post('/', async (req, res) => {
  try {
    const {
      organization_id,
      title,
      description,
      location,
      start_date,
      end_date,
      max_participants,
      created_by,
      status,
    } = req.body;

    if (!organization_id || !title || !start_date || !end_date) {
      return res.status(400).json({
        error: 'organization_id, title, start_date, and end_date are required',
      });
    }

    if (new Date(end_date) < new Date(start_date)) {
      return res.status(400).json({ error: 'end_date must be greater than or equal to start_date' });
    }

    const eventStatus = status || 'DRAFT';

    const result = await db.query(
      `INSERT INTO events (
        organization_id, title, description, location,
        start_date, end_date, max_participants, created_by, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        organization_id,
        title.trim(),
        description || null,
        location ? location.trim() : null,
        start_date,
        end_date,
        max_participants || null,
        created_by || null,
        eventStatus,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ADMIN / OFFICER: Publish an event
router.put('/:id/publish', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      "UPDATE events SET status = 'PUBLISHED' WHERE id = $1 RETURNING *",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

