const express = require('express');
const router = express.Router();
const db = require('../db');

// DATA RELATED: Get all announcements across all organizations (or filter by organization_id)
router.get('/', async (req, res) => {
  try {
    const { organization_id, limit } = req.query;
    let queryText = `
      SELECT a.*,
             o.name    AS organization_name,
             o.acronym AS organization_acronym,
             o.logo    AS organization_logo,
             u.first_name AS author_first_name,
             u.last_name  AS author_last_name
        FROM announcements a
        JOIN organizations o ON o.id = a.organization_id
   LEFT JOIN users u         ON u.id = a.created_by
    `;
    const params = [];

    if (organization_id) {
      queryText += ' WHERE a.organization_id = $1';
      params.push(organization_id);
    }

    queryText += ' ORDER BY a.published_at DESC';

    if (limit) {
      params.push(parseInt(limit, 10));
      queryText += ` LIMIT $${params.length}`;
    }

    const result = await db.query(queryText, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DATA RELATED: Get announcement by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      `SELECT a.*,
              o.name    AS organization_name,
              o.acronym AS organization_acronym,
              u.first_name AS author_first_name,
              u.last_name  AS author_last_name
         FROM announcements a
         JOIN organizations o ON o.id = a.organization_id
    LEFT JOIN users u         ON u.id = a.created_by
        WHERE a.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Announcement not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// OFFICER/ADMIN: Post a new announcement
router.post('/', async (req, res) => {
  try {
    const { organization_id, title, content, created_by } = req.body;

    if (!organization_id || !title || !content) {
      return res.status(400).json({ error: 'organization_id, title, and content are required' });
    }

    const result = await db.query(
      `INSERT INTO announcements (organization_id, title, content, created_by, published_at)
       VALUES ($1, $2, $3, $4, now())
       RETURNING *`,
      [organization_id, title.trim(), content.trim(), created_by || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// OFFICER/ADMIN: Update announcement
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content } = req.body;

    const result = await db.query(
      `UPDATE announcements
          SET title = COALESCE($2, title),
              content = COALESCE($3, content)
        WHERE id = $1
        RETURNING *`,
      [id, title ? title.trim() : null, content ? content.trim() : null]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Announcement not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// OFFICER/ADMIN: Delete announcement
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('DELETE FROM announcements WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Announcement not found' });
    }
    res.json({ message: 'Announcement deleted successfully', announcement: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
