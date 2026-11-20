/**
 * Organization Documents Routes (backend/routes/documents.js)
 *
 * Links to the `documents` table (`document_type` and `document_status` ENUMs)
 * in ../database/student_org_db.sql.
 */
const express = require('express');
const router = express.Router();
const db = require('../db');
const { resolvePositiveInt } = require('../utils');
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
  SELECT d.id,
         d.organization_id,
         d.uploaded_by,
         d.title,
         d.doc_type,
         d.doc_type AS type,
         d.drive_file_id,
         d.drive_view_link,
         d.file_name,
         (d.file_data IS NOT NULL AND d.file_data != '') AS has_file_data,
         d.status,
         d.reviewed_by,
         d.reviewed_at,
         d.review_remarks,
         d.version,
         d.created_at,
         COALESCE(d.drive_view_link, d.drive_file_id) AS file_url,
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

// GET /api/documents/:id/file — Retrieve stored document file name and base64/data-URL bytes
router.get('/:id/file', async (req, res) => {
  try {
    const id = resolvePositiveInt(req.params.id);
    if (!id) {
      return res.status(400).json({ error: 'Valid document ID is required' });
    }
    const result = await db.query(
      'SELECT id, title, doc_type, file_name, file_data, drive_view_link, drive_file_id FROM documents WHERE id = $1',
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

// GET /api/documents — List all documents with optional organization_id, type, and status filters
router.get('/', async (req, res) => {
  try {
    const { organization_id, type, status } = req.query;
    let queryText = `${DOCUMENT_SELECT_QUERY} WHERE 1=1`;
    const params = [];

    if (organization_id) {
      const orgIdNum = resolvePositiveInt(organization_id);
      if (!orgIdNum) {
        return res.status(400).json({ error: 'Valid organization_id is required' });
      }
      params.push(orgIdNum);
      queryText += ` AND d.organization_id = $${params.length}`;
    }
    if (type) {
      params.push(normalizeDocType(type));
      queryText += ` AND d.doc_type = $${params.length}::document_type`;
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
    const organizationId = resolvePositiveInt(req.params.organization_id);
    if (!organizationId) {
      return res.status(400).json({ error: 'Valid organization_id is required' });
    }
    const { type, status } = req.query;

    let queryText = `${DOCUMENT_SELECT_QUERY} WHERE d.organization_id = $1`;
    const params = [organizationId];

    if (type) {
      params.push(normalizeDocType(type));
      queryText += ` AND d.doc_type = $${params.length}::document_type`;
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
      doc_type,
      title,
      file_url,
      file_name,
      fileName,
      file_data,
      fileData,
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

    const orgIdNum = resolvePositiveInt(organization_id);
    const trimmedTitle = title ? String(title).trim() : '';
    if (!orgIdNum || !trimmedTitle) {
      return res.status(400).json({
        error: 'Valid organization_id and title are required',
      });
    }

    const orgCheck = await db.query('SELECT id FROM organizations WHERE id = $1', [orgIdNum]);
    if (orgCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const safeUploadedBy = resolvePositiveInt(uploaded_by);
    const docType = normalizeDocType(type || doc_type);
    const resolvedFileName = (file_name || fileName || '').trim() || null;
    const resolvedFileData = typeof (file_data ?? fileData) === 'string' && (file_data ?? fileData).trim()
      ? (file_data ?? fileData).trim()
      : null;

    // ============================================================
    // [GOOGLE DRIVE API PLACEHOLDER — DOCUMENT & IMAGE FILE UPLOAD]
    // Insert Google Drive API file/image upload logic here so uploaded
    // files or event photos are stored in Google Drive and their
    // shareable link is saved into `resolvedFileUrl`.
    // ============================================================
    const resolvedFileUrl = (file_url || resolvedFileName || `/files/${encodeURIComponent(trimmedTitle)}`).trim();

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

    const resolvedDriveId = String(req.body?.drive_file_id || resolvedFileName || resolvedFileUrl).trim();
    const insertRes = await db.query(
      `INSERT INTO documents (organization_id, doc_type, title, drive_file_id, drive_view_link, file_name, file_data, uploaded_by, review_remarks, status)
       VALUES ($1, $2::document_type, $3, $4, $5, $6, $7, $8, $9, 'PENDING')
       RETURNING id`,
      [orgIdNum, docType, trimmedTitle, resolvedDriveId, resolvedFileUrl, resolvedFileName, resolvedFileData, safeUploadedBy, finalRemarks]
    );

    const fullDoc = await db.query(`${DOCUMENT_SELECT_QUERY} WHERE d.id = $1`, [insertRes.rows[0].id]);
    const docRow = fullDoc.rows[0];
    const orgName = docRow.organization_name || docRow.organization_acronym || 'Student Organization';
    const isAccomplishment = docType === 'REPORT' || trimmedTitle.toLowerCase().includes('accomplishment') || trimmedTitle.toLowerCase().includes('report');

    // 1. Notify assigned faculty adviser(s) that an officer submitted a document or accomplishment report
    await notifyAdvisersForOrg(orgIdNum, {
      type: 'APPROVAL',
      title: isAccomplishment ? `Accomplishment Report Submitted: ${trimmedTitle}` : `Document Submitted: ${trimmedTitle}`,
      message: isAccomplishment
        ? `An officer from ${orgName} submitted an Accomplishment Report "${trimmedTitle}" for your verification.`
        : `An officer from ${orgName} submitted ${docType} "${trimmedTitle}" for your review and endorsement.`,
    });

    // 2. Dispatch submission confirmation to the submitting officer
    if (safeUploadedBy) {
      await notifyUser(safeUploadedBy, {
        type: 'CONFIRMATION',
        title: isAccomplishment ? `Report Submitted: ${trimmedTitle}` : `Submission Confirmed: ${trimmedTitle}`,
        message: isAccomplishment
          ? `Your Accomplishment Report "${trimmedTitle}" for ${orgName} was submitted successfully and is queued for faculty adviser verification.`
          : `Your document "${trimmedTitle}" (${docType}) for ${orgName} was submitted successfully and is queued for faculty adviser review.`,
      });
    }

    // 3. Notify administrators for institutional oversight
    await notifyAdmins({
      type: 'APPROVAL',
      title: isAccomplishment ? `Accomplishment Report Submitted: ${trimmedTitle}` : `Document Submitted: ${trimmedTitle}`,
      message: `A ${isAccomplishment ? 'compliance accomplishment report' : docType + ' document'} "${trimmedTitle}" for ${orgName} has been submitted for review.`,
    });

    // 4. Record submission in audit logs
    await recordAuditLog({
      userId: safeUploadedBy,
      action: isAccomplishment ? 'SUBMIT_ACCOMPLISHMENT_REPORT' : 'SUBMIT_DOCUMENT',
      entity: 'documents',
      entityId: docRow.id,
      metadata: {
        title: trimmedTitle,
        organization_id: orgIdNum,
        doc_type: docType,
        description: `Submitted ${isAccomplishment ? 'Accomplishment Report' : `${docType} document`} "${trimmedTitle}" for ${orgName}`,
      },
      req,
    });

    res.status(201).json(docRow);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/documents/:id/review — Approve or reject a document and record reviewer remarks
router.put('/:id/review', async (req, res) => {
  try {
    const id = resolvePositiveInt(req.params.id);
    if (!id) {
      return res.status(400).json({ error: 'Valid document ID is required.' });
    }
    const { status, reviewed_by, review_remarks } = req.body || {};
    const safeReviewedBy = resolvePositiveInt(reviewed_by);

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
      [id, normalizedStatus, safeReviewedBy, finalReviewRemarks]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const fullDoc = await db.query(`${DOCUMENT_SELECT_QUERY} WHERE d.id = $1`, [id]);
    const docRow = fullDoc.rows[0];
    const isAccomplishment = (docRow.doc_type || docRow.type) === 'REPORT' || docRow.title.toLowerCase().includes('accomplishment') || docRow.title.toLowerCase().includes('report');

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
      userId: safeReviewedBy,
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
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/documents/:id — Delete a document record by ID
router.delete('/:id', async (req, res) => {
  try {
    const id = resolvePositiveInt(req.params.id);
    if (!id) {
      return res.status(400).json({ error: 'Valid document ID is required.' });
    }
    const result = await db.query('DELETE FROM documents WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const deletedDoc = result.rows[0];
    await recordAuditLog({
      userId: resolvePositiveInt(req.body?.user_id || req.query?.user_id),
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
