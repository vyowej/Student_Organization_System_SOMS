/**
 * Organization Documents Routes (backend/routes/documents.js)
 *
 * Links to the `documents` table (`document_type` and `document_status` ENUMs)
 * in ../database/student_org_db.sql.
 */
const express = require('express');
const router = express.Router();
const db = require('../db');
const {
  notifyUser,
  notifyAdvisersForOrg,
  notifyAdmins,
  recordAuditLog,
} = require('../notificationsHelper');

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
         uploader.suffix     AS uploader_suffix,
         CASE WHEN uploader.id IS NOT NULL THEN (uploader.last_name || ', ' || uploader.first_name || COALESCE(' ' || uploader.suffix, '')) ELSE NULL END AS uploader_name,
         reviewer.first_name AS reviewer_first_name,
         reviewer.last_name  AS reviewer_last_name,
         reviewer.suffix     AS reviewer_suffix,
         CASE WHEN reviewer.id IS NOT NULL THEN (reviewer.last_name || ', ' || reviewer.first_name || COALESCE(' ' || reviewer.suffix, '')) ELSE NULL END AS reviewer_name,
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
    const {
      organization_id,
      type,
      title,
      file_url,
      uploaded_by,
      review_remarks,
      objectives,
      activitiesConducted,
      activities_conducted,
      results,
      problemsEncountered,
      problems_encountered,
      recommendations,
      attendance,
      eventDate,
      event_date,
      summary,
    } = req.body;

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
    // ============================================================
    const resolvedFileUrl = (file_url || `/files/${encodeURIComponent(title.trim())}`).trim();

    let finalRemarks = review_remarks || null;
    const hasAccomplishmentFields = objectives !== undefined ||
      activitiesConducted !== undefined ||
      activities_conducted !== undefined ||
      results !== undefined ||
      problemsEncountered !== undefined ||
      problems_encountered !== undefined ||
      recommendations !== undefined;

    if (hasAccomplishmentFields) {
      const metaObj = {
        eventId: req.body.eventId || req.body.event_id || null,
        venue: (req.body.venue || '').trim(),
        time: (req.body.time || '').trim(),
        registeredCount: req.body.registeredCount !== undefined && req.body.registeredCount !== null ? Number(req.body.registeredCount) : null,
        attendance: attendance !== undefined && attendance !== null ? Number(attendance) : null,
        eventDate: eventDate || event_date || null,
        objectives: (objectives || '').trim(),
        activitiesConducted: (activitiesConducted || activities_conducted || '').trim(),
        results: (results || summary || '').trim(),
        problemsEncountered: (problemsEncountered || problems_encountered || '').trim(),
        recommendations: (recommendations || '').trim(),
        summary: (summary || results || '').trim(),
        adviserRemarks: '',
      };
      finalRemarks = JSON.stringify(metaObj);
    }

    const insertRes = await db.query(
      `INSERT INTO documents (organization_id, type, title, file_url, uploaded_by, review_remarks, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'PENDING')
       RETURNING id`,
      [organization_id, docType, title.trim(), resolvedFileUrl, uploaded_by || null, finalRemarks]
    );

    const fullDoc = await db.query(`${DOCUMENT_SELECT_QUERY} WHERE d.id = $1`, [insertRes.rows[0].id]);
    const docRow = fullDoc.rows[0];
    const orgName = docRow.organization_name || docRow.organization_acronym || 'Student Organization';
    const isAccomplishment = docType === 'REPORT' || title.toLowerCase().includes('accomplishment') || title.toLowerCase().includes('report');

    // 1. Notify assigned faculty adviser(s) that an officer submitted a document or accomplishment report
    await notifyAdvisersForOrg(organization_id, {
      type: 'APPROVAL',
      title: isAccomplishment ? `Accomplishment Report Submitted: ${title.trim()}` : `Document Submitted: ${title.trim()}`,
      message: isAccomplishment
        ? `An officer from ${orgName} submitted an Accomplishment Report "${title.trim()}" for your verification.`
        : `An officer from ${orgName} submitted ${docType} "${title.trim()}" for your review and endorsement.`,
    });

    // 2. Dispatch submission confirmation to the submitting officer
    if (uploaded_by) {
      await notifyUser(uploaded_by, {
        type: 'CONFIRMATION',
        title: isAccomplishment ? `Report Submitted: ${title.trim()}` : `Submission Confirmed: ${title.trim()}`,
        message: isAccomplishment
          ? `Your Accomplishment Report "${title.trim()}" for ${orgName} was submitted successfully and is queued for faculty adviser verification.`
          : `Your document "${title.trim()}" (${docType}) for ${orgName} was submitted successfully and is queued for faculty adviser review.`,
      });
    }

    // 3. Notify administrators for institutional oversight
    await notifyAdmins({
      type: 'APPROVAL',
      title: isAccomplishment ? `Accomplishment Report Submitted: ${title.trim()}` : `Document Submitted: ${title.trim()}`,
      message: `A ${isAccomplishment ? 'compliance accomplishment report' : docType + ' document'} "${title.trim()}" for ${orgName} has been submitted for review.`,
    });

    // 4. Record submission in audit logs
    await recordAuditLog({
      userId: uploaded_by || null,
      action: isAccomplishment ? 'SUBMIT_ACCOMPLISHMENT_REPORT' : 'SUBMIT_DOCUMENT',
      entity: 'documents',
      entityId: docRow.id,
      metadata: {
        title: title.trim(),
        organization_id,
        doc_type: docType,
        description: `Submitted ${isAccomplishment ? 'Accomplishment Report' : `${docType} document`} "${title.trim()}" for ${orgName}`,
      },
      req,
    });

    res.status(201).json(docRow);
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

    // Extract clean human review remarks / adviser comment
    let incomingComment = review_remarks !== undefined ? review_remarks : null;
    while (typeof incomingComment === 'string' && incomingComment.trim().startsWith('{') && incomingComment.trim().endsWith('}')) {
      try {
        const parsedIncoming = JSON.parse(incomingComment.trim());
        if (parsedIncoming && typeof parsedIncoming === 'object') {
          incomingComment = parsedIncoming.adviserRemarks ?? parsedIncoming.remarks ?? parsedIncoming.comment ?? '';
        } else {
          break;
        }
      } catch {
        break;
      }
    }

    // If existing document has JSON accomplishment metadata in review_remarks, preserve it
    let finalReviewRemarks = incomingComment;
    const existingDoc = await db.query('SELECT review_remarks FROM documents WHERE id = $1', [id]);
    if (existingDoc.rows.length > 0 && existingDoc.rows[0].review_remarks) {
      const rawText = String(existingDoc.rows[0].review_remarks).trim();
      if (rawText.startsWith('{') && rawText.endsWith('}')) {
        try {
          const parsed = JSON.parse(rawText);
          if (parsed && typeof parsed === 'object') {
            parsed.adviserRemarks = incomingComment !== null && incomingComment !== undefined ? String(incomingComment).trim() : '';
            parsed.status = normalizedStatus;
            finalReviewRemarks = JSON.stringify(parsed);
          }
        } catch {
          // keep as is
        }
      }
    }

    const result = await db.query(
      `UPDATE documents
          SET status = $2,
              reviewed_by = COALESCE($3, reviewed_by),
              review_remarks = COALESCE($4, review_remarks),
              reviewed_at = now()
        WHERE id = $1
        RETURNING id`,
      [id, normalizedStatus, reviewed_by || null, finalReviewRemarks]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const fullDoc = await db.query(`${DOCUMENT_SELECT_QUERY} WHERE d.id = $1`, [id]);
    const docRow = fullDoc.rows[0];
    const isAccomplishment = docRow.type === 'REPORT' || docRow.title.toLowerCase().includes('accomplishment') || docRow.title.toLowerCase().includes('report');

    // Notify the uploading officer about the review outcome
    if (docRow.uploaded_by) {
      const outcomeText = normalizedStatus === 'APPROVED'
        ? (isAccomplishment ? 'verified and approved' : 'approved')
        : (isAccomplishment ? 'returned for revision' : 'rejected');
      let humanRemarks = '';
      if (typeof review_remarks === 'string') {
        const trimmed = review_remarks.trim();
        if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
          try {
            const parsed = JSON.parse(trimmed);
            humanRemarks = parsed.adviserRemarks || '';
          } catch {
            humanRemarks = '';
          }
        } else {
          humanRemarks = trimmed;
        }
      }
      await notifyUser(docRow.uploaded_by, {
        type: 'DOCUMENT_REVIEW',
        title: isAccomplishment
          ? `Accomplishment Report ${normalizedStatus === 'APPROVED' ? 'Verified' : 'Returned'}: ${docRow.title}`
          : `Document ${normalizedStatus}: ${docRow.title}`,
        message: `Your ${isAccomplishment ? 'Accomplishment Report' : 'document'} "${docRow.title}" was ${outcomeText} by ${docRow.reviewer_name || 'the faculty adviser'}.${humanRemarks ? ` Remarks: ${humanRemarks}` : ''}`,
      });
    }

    // Record review in audit logs
    await recordAuditLog({
      userId: reviewed_by || null,
      action: `REVIEW_DOCUMENT_${normalizedStatus}`,
      entity: 'documents',
      entityId: docRow.id,
      metadata: {
        title: docRow.title,
        organization_id: docRow.organization_id,
        status: normalizedStatus,
        review_remarks,
        description: `Reviewed document "${docRow.title}" for ${docRow.organization_name || 'organization'}: ${normalizedStatus}`,
      },
      req,
    });

    res.json(docRow);
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

    const deletedDoc = result.rows[0];
    await recordAuditLog({
      userId: req.body?.user_id || req.query?.user_id || null,
      action: 'DELETE_DOCUMENT',
      entity: 'documents',
      entityId: id,
      metadata: {
        title: deletedDoc.title,
        organization_id: deletedDoc.organization_id,
        description: `Deleted document "${deletedDoc.title}"`,
      },
      req,
    });

    res.json({ message: 'Document deleted', document: deletedDoc });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
