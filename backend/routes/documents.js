/**
 * Organization Documents Routes (backend/routes/documents.js)
 *
 * Links to the `documents` table (`document_type` and `document_status` ENUMs)
 * in ../database/student_org_db.sql.
 */
const express = require('express');
const router = express.Router();
const db = require('../db');

const VALID_DOC_TYPES = ['CONSTITUTION', 'PROPOSAL', 'FINANCIAL', 'REPORT', 'CERTIFICATE'];
const VALID_DOC_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'];

function normalizeDocType(input) {
  if (!input) return 'REPORT';
  const upper = String(input).trim().toUpperCase();
  if (VALID_DOC_TYPES.includes(upper)) return upper;
  if (upper.includes('CONSTITUTION') || upper.includes('BYLAW')) return 'CONSTITUTION';
  if (upper.includes('PROPOSAL') || upper.includes('EVENT')) return 'PROPOSAL';
  if (upper.includes('FINANCIAL') || upper.includes('BUDGET') || upper.includes('LIQUIDATION')) return 'FINANCIAL';
  if (upper.includes('CERT')) return 'CERTIFICATE';
  return 'REPORT';
}

function normalizeDocStatus(input) {
  if (!input) return 'PENDING';
  const upper = String(input).trim().toUpperCase();
  if (VALID_DOC_STATUSES.includes(upper)) return upper;
  if (upper === 'VERIFIED') return 'APPROVED';
  if (upper === 'RETURNED' || upper === 'PENDING_VERIFICATION' || upper === 'REVISION_REQUESTED') return 'PENDING';
  return 'PENDING';
}

const DOCUMENT_SELECT_QUERY = `
  SELECT d.*,
         o.name AS organization_name,
         o.acronym AS organization_acronym,
         uploader.first_name AS uploader_first_name,
         uploader.last_name  AS uploader_last_name,
         CASE WHEN uploader.id IS NOT NULL THEN (uploader.last_name || ', ' || uploader.first_name) ELSE NULL END AS uploader_name,
         reviewer.first_name AS reviewer_first_name,
         reviewer.last_name  AS reviewer_last_name,
         CASE WHEN reviewer.id IS NOT NULL THEN (reviewer.last_name || ', ' || reviewer.first_name) ELSE NULL END AS reviewer_name,
         reviewer.role AS reviewer_role
    FROM documents d
    JOIN organizations o     ON o.id = d.organization_id
    LEFT JOIN users uploader ON uploader.id = d.uploaded_by
    LEFT JOIN users reviewer ON reviewer.id = d.reviewed_by
`;

// GET /api/documents — List all documents with optional organization_id, type, and status filters
router.get('/', async (req, res) => {
  try {
    const { organization_id, type, status } = req.query;
    let queryText = `${DOCUMENT_SELECT_QUERY} WHERE 1=1`;
    const params = [];

    if (organization_id) {
      params.push(organization_id);
      queryText += ` AND d.organization_id = $${params.length}`;
    }
    if (type) {
      params.push(normalizeDocType(type));
      queryText += ` AND d.type = $${params.length}`;
    }
    if (status) {
      params.push(normalizeDocStatus(status));
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

// GET /api/documents/org/:organization_id — List documents for an organization with optional type/status filters
router.get('/org/:organization_id', async (req, res) => {
  try {
    const { organization_id } = req.params;
    const { type, status } = req.query;

    let queryText = `${DOCUMENT_SELECT_QUERY} WHERE d.organization_id = $1`;
    const params = [organization_id];

    if (type) {
      params.push(normalizeDocType(type));
      queryText += ` AND d.type = $${params.length}`;
    }
    if (status) {
      params.push(normalizeDocStatus(status));
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

// POST /api/documents — Upload/submit a new organization document (PENDING review by default)
router.post('/', async (req, res) => {
  try {
    const { organization_id, type, title, file_url, uploaded_by, review_remarks } = req.body;

    if (!organization_id || !title) {
      return res.status(400).json({
        error: 'organization_id and title are required',
      });
    }

    const docType = normalizeDocType(type);

    // ============================================================
    // [GOOGLE DRIVE API PLACEHOLDER — DOCUMENT & IMAGE FILE UPLOAD]
    // Insert Google Drive API file/image upload logic here so uploaded
    // files or event photos are stored in Google Drive and their
    // shareable link is saved into `resolvedFileUrl`.
    //
    //
    //
    // ============================================================
    const resolvedFileUrl = (file_url || `/files/${encodeURIComponent(title.trim())}`).trim();

    const insertRes = await db.query(
      `INSERT INTO documents (organization_id, type, title, file_url, uploaded_by, review_remarks, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'PENDING')
       RETURNING id`,
      [organization_id, docType, title.trim(), resolvedFileUrl, uploaded_by || null, review_remarks || null]
    );

    const fullDoc = await db.query(`${DOCUMENT_SELECT_QUERY} WHERE d.id = $1`, [insertRes.rows[0].id]);
    res.status(201).json(fullDoc.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

// PUT /api/documents/:id/review — Approve or reject a document and record reviewer remarks
router.put('/:id/review', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reviewed_by, review_remarks } = req.body;

    const normalizedStatus = normalizeDocStatus(status);

    const result = await db.query(
      `UPDATE documents
          SET status = $2,
              reviewed_by = COALESCE($3, reviewed_by),
              review_remarks = COALESCE($4, review_remarks),
              reviewed_at = now()
        WHERE id = $1
        RETURNING id`,
      [id, normalizedStatus, reviewed_by || null, review_remarks !== undefined ? review_remarks : null]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const fullDoc = await db.query(`${DOCUMENT_SELECT_QUERY} WHERE d.id = $1`, [id]);
    res.json(fullDoc.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Server error' });
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

    res.json({ message: 'Document deleted', document: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
