/**
 * Organization Documents Routes (backend/routes/documents.js)
 *
 * Links to the `documents` table (`document_type` and `document_status` ENUMs)
 * in ../database/student_org_db.sql.
 */
const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/documents/org/:organization_id — List documents for an organization with optional type/status filters
router.get('/org/:organization_id', async (req, res) => {
  try {
    const { organization_id } = req.params;
    const { type, status } = req.query;

    let queryText = `
      SELECT d.*,
             uploader.first_name AS uploader_first_name,
             uploader.last_name  AS uploader_last_name,
             reviewer.first_name AS reviewer_first_name,
             reviewer.last_name  AS reviewer_last_name
        FROM documents d
   LEFT JOIN users uploader ON uploader.id = d.uploaded_by
   LEFT JOIN users reviewer ON reviewer.id = d.reviewed_by
       WHERE d.organization_id = $1
    `;
    const params = [organization_id];

    if (type) {
      params.push(type);
      queryText += ` AND d.type = $${params.length}`;
    }
    if (status) {
      params.push(status);
      queryText += ` AND d.status = $${params.length}`;
    }

    queryText += ' ORDER BY d.created_at DESC';

    const result = await db.query(queryText, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/documents/:id — Retrieve a single document record by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      `SELECT d.*,
              o.name AS organization_name,
              uploader.first_name AS uploader_first_name,
              uploader.last_name  AS uploader_last_name
         FROM documents d
         JOIN organizations o ON o.id = d.organization_id
    LEFT JOIN users uploader ON uploader.id = d.uploaded_by
        WHERE d.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/documents — Submit a new organization document (defaults to PENDING status)
router.post('/', async (req, res) => {
  try {
    const { organization_id, type, title, file_url, uploaded_by } = req.body;

    if (!organization_id || !type || !title || !file_url) {
      return res.status(400).json({
        error: 'organization_id, type, title, and file_url are required',
      });
    }

    // Matches document_type ENUM in database/student_org_db.sql
    const validTypes = ['CONSTITUTION', 'PROPOSAL', 'FINANCIAL', 'REPORT', 'CERTIFICATE'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        error: `Invalid document type. Allowed types: ${validTypes.join(', ')}`,
      });
    }

    const result = await db.query(
      `INSERT INTO documents (
        organization_id, type, title, file_url, status, uploaded_by
      ) VALUES ($1, $2, $3, $4, 'PENDING', $5)
      RETURNING *`,
      [organization_id, type, title.trim(), file_url.trim(), uploaded_by || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/documents/:id/review — Approve or reject a submitted document
router.put('/:id/review', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reviewed_by, review_remarks } = req.body;

    if (!['APPROVED', 'REJECTED'].includes(status)) {
      return res.status(400).json({ error: "status must be 'APPROVED' or 'REJECTED'" });
    }

    const result = await db.query(
      `UPDATE documents
          SET status = $2,
              reviewed_by = $3,
              review_remarks = $4,
              reviewed_at = now()
        WHERE id = $1
        RETURNING *`,
      [id, status, reviewed_by || null, review_remarks || null]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/documents/:id — Delete a document record by ID
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('DELETE FROM documents WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.json({ message: 'Document deleted successfully', document: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

