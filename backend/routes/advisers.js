/**
 * Organization Advisers & Change Requests Routes (backend/routes/advisers.js)
 *
 * Links to `advisers`, `organization_advisers`, and `adviser_change_requests`
 * tables in ../database/student_org_db.sql.
 */
const express = require('express');
const router = express.Router();
let bcrypt;
try {
  bcrypt = require('bcrypt');
} catch {
  bcrypt = require('bcryptjs');
}
const db = require('../db');
const {
  notifyUser,
  notifyAdmins,
  recordAuditLog,
} = require('../notificationsHelper');

// GET /api/advisers — List all faculty advisers with user, college, and active organization assignments
router.get('/', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT a.id,
             a.user_id,
             a.employee_number,
             a.title,
             a.is_coordinator,
             a.college_id,
             u.email,
             u.status,
             u.first_name,
             u.middle_name,
             u.last_name,
             u.suffix,
             TRIM(
               CONCAT_WS(' ', a.title, u.first_name, u.middle_name, u.last_name) || 
               CASE 
                 WHEN u.suffix IS NULL OR u.suffix = '' THEN ''
                 WHEN u.suffix ILIKE 'Jr%' OR u.suffix ILIKE 'Sr%' THEN ' ' || u.suffix
                 ELSE ', ' || u.suffix
               END
             ) AS name,
             (u.last_name || ', ' || u.first_name || COALESCE(' ' || u.suffix, '')) AS roster_name,
             c.name AS college_name,
             c.acronym AS college_acronym,
             COALESCE(
               (SELECT json_agg(json_build_object(
                 'organization_id', oa.organization_id,
                 'organization_name', o.name,
                 'organization_acronym', o.acronym,
                 'assigned_at', oa.assigned_at
               ))
                FROM organization_advisers oa
                JOIN organizations o ON o.id = oa.organization_id
               WHERE oa.adviser_id = a.id AND oa.ended_at IS NULL),
               '[]'::json
             ) AS active_organizations
        FROM advisers a
        JOIN users u ON u.id = a.user_id
   LEFT JOIN colleges c ON c.id = a.college_id
       ORDER BY u.last_name ASC, u.first_name ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/advisers/assignments — List all current and historical organization_advisers records
router.get('/assignments', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT oa.*,
             (oa.ended_at IS NULL) AS is_current,
             o.name AS organization_name,
             o.acronym AS organization_acronym,
             a.employee_number,
             u.id AS adviser_user_id,
             u.first_name,
             u.middle_name,
             u.last_name,
             u.suffix,
             (u.last_name || ', ' || u.first_name || COALESCE(' ' || u.suffix, '')) AS adviser_name,
             u.email,
             c.name AS college_name,
             assigner.first_name AS assigner_first_name,
             assigner.last_name  AS assigner_last_name
        FROM organization_advisers oa
        JOIN organizations o ON o.id = oa.organization_id
        JOIN advisers a      ON a.id = oa.adviser_id
        JOIN users u         ON u.id = a.user_id
   LEFT JOIN colleges c      ON c.id = a.college_id
   LEFT JOIN users assigner  ON assigner.id = oa.assigned_by
       ORDER BY oa.assigned_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/advisers/org/:organization_id — Fetch current and past advisers for an organization
router.get('/org/:organization_id', async (req, res) => {
  try {
    const { organization_id } = req.params;
    const result = await db.query(
      `SELECT oa.id,
              oa.organization_id,
              oa.adviser_id,
              oa.assigned_at,
              oa.ended_at,
              (oa.ended_at IS NULL) AS is_current,
              a.employee_number,
              u.first_name,
              u.middle_name,
              u.last_name,
              u.suffix,
              (u.last_name || ', ' || u.first_name || COALESCE(' ' || u.suffix, '')) AS adviser_name,
              u.email,
              c.name AS college_name,
              assigner.first_name AS assigner_first_name,
              assigner.last_name  AS assigner_last_name
         FROM organization_advisers oa
         JOIN advisers a       ON a.id = oa.adviser_id
         JOIN users u          ON u.id = a.user_id
    LEFT JOIN colleges c       ON c.id = a.college_id
    LEFT JOIN users assigner   ON assigner.id = oa.assigned_by
        WHERE oa.organization_id = $1
        ORDER BY oa.assigned_at DESC`,
      [organization_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/advisers — Pre-generate / prepare a faculty adviser account beforehand (Admin or Coordinator / Ma'am Marj)
router.post('/', async (req, res) => {
  const client = await db.pool.connect();
  try {
    const {
      first_name,
      firstName,
      middle_name,
      middleName,
      last_name,
      lastName,
      suffix,
      title,
      email,
      password,
      employee_number,
      employeeNumber,
      college_id,
      collegeId,
      organization_id,
      organizationId,
      is_coordinator,
      isCoordinator,
      created_by,
    } = req.body || {};

    const cleanEmail = String(email || '').trim().toLowerCase();
    const fName = String(first_name || firstName || '').trim();
    const lName = String(last_name || lastName || '').trim();
    const mName = String(middle_name || middleName || '').trim() || null;
    const sfx = String(suffix || '').trim() || null;
    const advTitle = String(title || '').trim() || null;

    if (!cleanEmail || !fName || !lName) {
      return res.status(400).json({ error: 'First name, last name, and institutional email are required.' });
    }

    const rawPassword = String(password || 'adviser123').trim() || 'adviser123';
    const passwordHash = await bcrypt.hash(rawPassword, 10);
    const targetCollegeId = (college_id || collegeId) ? Number(college_id || collegeId) : null;
    const targetOrgId = (organization_id || organizationId) ? Number(organization_id || organizationId) : null;
    const coordinatorFlag = Boolean(is_coordinator ?? isCoordinator ?? false);

    await client.query('BEGIN');

    const userRes = await client.query(
      `INSERT INTO users (email, password_hash, first_name, middle_name, last_name, suffix, role, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'ADVISER', 'ACTIVE')
       ON CONFLICT (lower(email)) DO UPDATE
         SET first_name = EXCLUDED.first_name,
             middle_name = EXCLUDED.middle_name,
             last_name = EXCLUDED.last_name,
             suffix = EXCLUDED.suffix,
             role = 'ADVISER',
             status = 'ACTIVE'
       RETURNING id`,
      [cleanEmail, passwordHash, fName, mName, lName, sfx]
    );
    const userId = userRes.rows[0].id;
    const empNum = String(employee_number || employeeNumber || '').trim() || `EMP-ADV-${String(userId).padStart(3, '0')}`;

    const advRes = await client.query(
      `INSERT INTO advisers (user_id, employee_number, title, is_coordinator, college_id)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id) DO UPDATE
         SET employee_number = EXCLUDED.employee_number,
             title = COALESCE(EXCLUDED.title, advisers.title),
             is_coordinator = EXCLUDED.is_coordinator,
             college_id = COALESCE(EXCLUDED.college_id, advisers.college_id)
       RETURNING id`,
      [userId, empNum, advTitle, coordinatorFlag, targetCollegeId]
    );
    const adviserId = advRes.rows[0].id;

    let assignedOrgName = null;
    if (targetOrgId) {
      await client.query(
        'UPDATE organization_advisers SET ended_at = now() WHERE organization_id = $1 AND ended_at IS NULL',
        [targetOrgId]
      );
      await client.query(
        `INSERT INTO organization_advisers (organization_id, adviser_id, assigned_by, assigned_at)
         VALUES ($1, $2, $3, now())`,
        [targetOrgId, adviserId, created_by || null]
      );
      const oRes = await client.query('SELECT name FROM organizations WHERE id = $1', [targetOrgId]);
      assignedOrgName = oRes.rows[0]?.name || null;
    }

    await client.query('COMMIT');

    await recordAuditLog({
      userId: created_by || null,
      action: 'PREGENERATE_ADVISER_ACCOUNT',
      entity: 'advisers',
      entityId: adviserId,
      metadata: {
        email: cleanEmail,
        employee_number: empNum,
        organization_id: targetOrgId,
        description: `Pre-generated faculty adviser account for ${advTitle ? `${advTitle} ` : ''}${fName} ${lName} (${cleanEmail})${assignedOrgName ? ` assigned to ${assignedOrgName}` : ''}.`,
      },
      req,
    });

    res.status(201).json({
      id: adviserId,
      user_id: userId,
      email: cleanEmail,
      employee_number: empNum,
      title: advTitle,
      first_name: fName,
      last_name: lName,
      is_coordinator: coordinatorFlag,
      organization_id: targetOrgId,
      organization_name: assignedOrgName,
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(err);
    if (err.code === '23505') {
      return res.status(409).json({ error: 'An adviser account with that email or employee number already exists.' });
    }
    res.status(500).json({ error: err.message || 'Server error creating adviser account' });
  } finally {
    client.release();
  }
});

// POST /api/advisers/pregenerate-missing — Pre-generate adviser accounts for all organizations without an active adviser
router.post('/pregenerate-missing', async (req, res) => {
  const client = await db.pool.connect();
  try {
    const { created_by, default_password } = req.body || {};
    const passwordHash = await bcrypt.hash(String(default_password || 'adviser123'), 10);

    await client.query('BEGIN');
    const unassigned = await client.query(`
      SELECT o.id, o.name, o.acronym, o.college_id
        FROM organizations o
       WHERE NOT EXISTS (
         SELECT 1 FROM organization_advisers oa
          WHERE oa.organization_id = o.id AND oa.ended_at IS NULL
       )
       ORDER BY o.id ASC
    `);

    const generated = [];
    for (const org of unassigned.rows) {
      const slug = (org.acronym || org.name || `org${org.id}`)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '')
        .slice(0, 22) || `org${org.id}`;
      const email = `adviser.${slug}.${org.id}@wmsu.edu.ph`;
      const empNum = `EMP-PREP-${String(org.id).padStart(3, '0')}`;
      const label = org.acronym || org.name.split(/\s+/).slice(0, 3).join(' ');

      const uRes = await client.query(
        `INSERT INTO users (email, password_hash, first_name, last_name, role, status)
         VALUES ($1, $2, $3, $4, 'ADVISER', 'ACTIVE')
         ON CONFLICT (lower(email)) DO UPDATE SET status = 'ACTIVE'
         RETURNING id`,
        [email, passwordHash, `${label} Adviser`, '(Prepared)']
      );
      const aRes = await client.query(
        `INSERT INTO advisers (user_id, employee_number, title, college_id)
         VALUES ($1, $2, 'Prof.', $3)
         ON CONFLICT (user_id) DO UPDATE
           SET employee_number = COALESCE(advisers.employee_number, EXCLUDED.employee_number)
         RETURNING id`,
        [uRes.rows[0].id, empNum, org.college_id || null]
      );
      await client.query(
        `INSERT INTO organization_advisers (organization_id, adviser_id, assigned_by, assigned_at)
         VALUES ($1, $2, $3, now())`,
        [org.id, aRes.rows[0].id, created_by || null]
      );
      generated.push({ organization_id: org.id, organization_name: org.name, email, employee_number: empNum });
    }

    await client.query('COMMIT');

    await recordAuditLog({
      userId: created_by || null,
      action: 'BULK_PREGENERATE_ADVISERS',
      entity: 'advisers',
      metadata: {
        count: generated.length,
        description: `Pre-generated ${generated.length} faculty adviser account(s) for unassigned organizations.`,
      },
      req,
    });

    res.json({ ok: true, count: generated.length, generated });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(err);
    res.status(500).json({ error: err.message || 'Server error pre-generating adviser accounts' });
  } finally {
    client.release();
  }
});

// POST /api/advisers/assign — End any current adviser assignment (uq_one_current_adviser) and assign a new one
router.post('/assign', async (req, res) => {
  try {
    const { organization_id, adviser_id, assigned_by } = req.body;

    if (!organization_id || !adviser_id) {
      return res.status(400).json({ error: 'organization_id and adviser_id are required' });
    }

    // Close existing active adviser assignment so uq_one_current_adviser is satisfied
    await db.query(
      `UPDATE organization_advisers
          SET ended_at = now()
        WHERE organization_id = $1 AND ended_at IS NULL`,
      [organization_id]
    );

    const result = await db.query(
      `INSERT INTO organization_advisers (organization_id, adviser_id, assigned_by, assigned_at)
       VALUES ($1, $2, $3, now())
       RETURNING *`,
      [organization_id, adviser_id, assigned_by || null]
    );

    // Look up adviser user_id and organization name
    const infoRes = await db.query(
      `SELECT a.user_id, o.name AS organization_name
         FROM advisers a, organizations o
        WHERE a.id = $1 AND o.id = $2`,
      [adviser_id, organization_id]
    );
    if (infoRes.rows.length > 0) {
      const { user_id, organization_name } = infoRes.rows[0];
      await notifyUser(user_id, {
        type: 'ADVISER',
        title: `Assigned as Faculty Adviser: ${organization_name}`,
        message: `You have been officially assigned as faculty adviser for "${organization_name}".`,
      });
      await recordAuditLog({
        userId: assigned_by || null,
        action: 'ASSIGN_ADVISER',
        entity: 'organization_advisers',
        entityId: result.rows[0].id,
        metadata: {
          organization_id,
          adviser_id,
          description: `Assigned faculty adviser #${adviser_id} to ${organization_name || 'organization'}`,
        },
        req,
      });
    }

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/advisers/requests — List adviser change requests with optional status and organization filters
router.get('/requests', async (req, res) => {
  try {
    const { status, organization_id } = req.query;
    let queryText = `
      SELECT acr.*,
             o.name AS organization_name,
             o.acronym AS organization_acronym,
             cu.first_name AS current_adviser_first_name,
             cu.last_name  AS current_adviser_last_name,
             cu.suffix     AS current_adviser_suffix,
             CASE WHEN cu.id IS NOT NULL THEN (cu.last_name || ', ' || cu.first_name || COALESCE(' ' || cu.suffix, '')) ELSE NULL END AS current_adviser_name,
             pu.first_name AS proposed_adviser_first_name,
             pu.last_name  AS proposed_adviser_last_name,
             pu.suffix     AS proposed_adviser_suffix,
             CASE WHEN pu.id IS NOT NULL THEN (pu.last_name || ', ' || pu.first_name || COALESCE(' ' || pu.suffix, '')) ELSE NULL END AS proposed_adviser_name,
             req_user.first_name AS requester_first_name,
             req_user.last_name  AS requester_last_name,
             req_user.suffix     AS requester_suffix,
             CASE WHEN req_user.id IS NOT NULL THEN (req_user.last_name || ', ' || req_user.first_name || COALESCE(' ' || req_user.suffix, '')) ELSE NULL END AS requester_name,
             rev_user.first_name AS reviewer_first_name,
             rev_user.last_name  AS reviewer_last_name
        FROM adviser_change_requests acr
        JOIN organizations o ON o.id = acr.organization_id
   LEFT JOIN advisers ca     ON ca.id = acr.current_adviser_id
   LEFT JOIN users cu        ON cu.id = ca.user_id
   LEFT JOIN advisers pa     ON pa.id = acr.proposed_adviser_id
   LEFT JOIN users pu        ON pu.id = pa.user_id
   LEFT JOIN users req_user  ON req_user.id = acr.requested_by
   LEFT JOIN users rev_user  ON rev_user.id = acr.reviewed_by
       WHERE 1=1
    `;
    const params = [];

    if (status) {
      params.push(status);
      queryText += ` AND acr.status = $${params.length}`;
    }
    if (organization_id) {
      params.push(organization_id);
      queryText += ` AND acr.organization_id = $${params.length}`;
    }

    queryText += ' ORDER BY acr.created_at DESC';

    const result = await db.query(queryText, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/advisers/requests — Submit a new adviser change request (uq_one_pending_change_request)
router.post('/requests', async (req, res) => {
  try {
    const { organization_id, requested_by, reason } = req.body;
    const proposed_adviser_id = req.body.proposed_adviser_id || req.body.requested_adviser_id;

    if (!organization_id || !proposed_adviser_id || !reason) {
      return res.status(400).json({
        error: 'organization_id, proposed_adviser_id, and reason are required',
      });
    }

    // Look up the active adviser for the organization to populate current_adviser_id
    const currentAdvRes = await db.query(
      'SELECT adviser_id FROM organization_advisers WHERE organization_id = $1 AND ended_at IS NULL',
      [organization_id]
    );
    const currentAdviserId = currentAdvRes.rows.length > 0 ? currentAdvRes.rows[0].adviser_id : null;

    // Enforce CHECK (current_adviser_id IS DISTINCT FROM proposed_adviser_id)
    if (currentAdviserId !== null && Number(currentAdviserId) === Number(proposed_adviser_id)) {
      return res.status(400).json({ error: 'Proposed adviser is already the current adviser' });
    }

    const result = await db.query(
      `INSERT INTO adviser_change_requests (
        organization_id, current_adviser_id, proposed_adviser_id, requested_by, reason, status
      ) VALUES ($1, $2, $3, $4, $5, 'PENDING')
      RETURNING *`,
      [organization_id, currentAdviserId, proposed_adviser_id, requested_by || null, reason.trim()]
    );

    const orgInfo = await db.query('SELECT name FROM organizations WHERE id = $1', [organization_id]);
    const orgName = orgInfo.rows[0]?.name || 'Organization';

    // 1. Look up proposed adviser's user_id and notify them
    const proposedAdv = await db.query('SELECT user_id FROM advisers WHERE id = $1', [proposed_adviser_id]);
    if (proposedAdv.rows.length > 0 && proposedAdv.rows[0].user_id) {
      await notifyUser(proposedAdv.rows[0].user_id, {
        type: 'APPROVAL',
        title: `Faculty Adviser Nomination: ${orgName}`,
        message: `You have been nominated as faculty adviser for "${orgName}". Reason: "${reason.trim()}". Pending administration review.`,
      });
    }

    // 2. Look up current adviser's user_id if present and notify them
    if (currentAdviserId) {
      const currentAdv = await db.query('SELECT user_id FROM advisers WHERE id = $1', [currentAdviserId]);
      if (currentAdv.rows.length > 0 && currentAdv.rows[0].user_id) {
        await notifyUser(currentAdv.rows[0].user_id, {
          type: 'ADVISER_CHANGE',
          title: `Adviser Change Requested: ${orgName}`,
          message: `An adviser change request was submitted for "${orgName}".`,
        });
      }
    }

    // 3. Confirm submission to the requesting officer
    if (requested_by) {
      await notifyUser(requested_by, {
        type: 'CONFIRMATION',
        title: `Adviser Request Submitted: ${orgName}`,
        message: `Your request to assign a new faculty adviser for "${orgName}" has been submitted for administrative review.`,
      });
    }

    // 4. Notify admins for review
    await notifyAdmins({
      type: 'APPROVAL',
      title: `Adviser Change Request: ${orgName}`,
      message: `A request to change faculty adviser for "${orgName}" has been submitted for review.`,
    });

    // 5. Record in audit logs
    await recordAuditLog({
      userId: requested_by || null,
      action: 'REQUEST_ADVISER_CHANGE',
      entity: 'adviser_change_requests',
      entityId: result.rows[0].id,
      metadata: {
        organization_id,
        proposed_adviser_id,
        current_adviser_id: currentAdviserId,
        reason: reason.trim(),
        description: `Submitted adviser change request for "${orgName}"`,
      },
      req,
    });

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A pending adviser change request already exists for this organization' });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/advisers/requests/:id/review — Approve, reject, or cancel a pending adviser change request
router.put('/requests/:id/review', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reviewed_by, review_remarks } = req.body;

    const normalizedStatus = String(status || '').toUpperCase();
    if (!['APPROVED', 'REJECTED', 'CANCELLED'].includes(normalizedStatus)) {
      return res.status(400).json({ error: "status must be 'APPROVED', 'REJECTED', or 'CANCELLED'" });
    }

    const reqResult = await db.query(
      `UPDATE adviser_change_requests
          SET status = $2,
              reviewed_by = $3,
              review_remarks = $4,
              reviewed_at = now()
        WHERE id = $1 AND status = 'PENDING'
        RETURNING *`,
      [id, normalizedStatus, reviewed_by || null, review_remarks || null]
    );

    if (reqResult.rows.length === 0) {
      return res.status(404).json({ error: 'Request not found or already reviewed' });
    }

    const changeRequest = reqResult.rows[0];

    // When approved, automatically transition the organization's active adviser
    if (normalizedStatus === 'APPROVED' && changeRequest.proposed_adviser_id) {
      await db.query(
        `UPDATE organization_advisers
            SET ended_at = now()
          WHERE organization_id = $1 AND ended_at IS NULL`,
        [changeRequest.organization_id]
      );

      await db.query(
        `INSERT INTO organization_advisers (organization_id, adviser_id, assigned_by, assigned_at)
         VALUES ($1, $2, $3, now())`,
        [changeRequest.organization_id, changeRequest.proposed_adviser_id, reviewed_by || null]
      );
    }

    // Look up organization name and users to notify
    const orgRes = await db.query('SELECT name FROM organizations WHERE id = $1', [changeRequest.organization_id]);
    const orgName = orgRes.rows[0]?.name || 'Organization';

    // 1. Notify the requesting officer of the review outcome
    if (changeRequest.requested_by) {
      await notifyUser(changeRequest.requested_by, {
        type: 'ADVISER_CHANGE',
        title: `Adviser Change Request ${normalizedStatus}: ${orgName}`,
        message: `Your request to change faculty adviser for "${orgName}" has been ${normalizedStatus.toLowerCase()}.${review_remarks ? ` Remarks: ${review_remarks}` : ''}`,
      });
    }

    // 2. Notify the proposed adviser
    if (changeRequest.proposed_adviser_id) {
      const paRes = await db.query('SELECT user_id FROM advisers WHERE id = $1', [changeRequest.proposed_adviser_id]);
      if (paRes.rows.length > 0 && paRes.rows[0].user_id) {
        await notifyUser(paRes.rows[0].user_id, {
          type: 'ADVISER_CHANGE',
          title: `Adviser Nomination ${normalizedStatus}: ${orgName}`,
          message: `Your nomination as faculty adviser for "${orgName}" was ${normalizedStatus.toLowerCase()}.${review_remarks ? ` Remarks: ${review_remarks}` : ''}`,
        });
      }
    }

    // 3. Record in audit logs
    await recordAuditLog({
      userId: reviewed_by || null,
      action: `REVIEW_ADVISER_CHANGE_${normalizedStatus}`,
      entity: 'adviser_change_requests',
      entityId: changeRequest.id,
      metadata: {
        organization_id: changeRequest.organization_id,
        status: normalizedStatus,
        review_remarks,
        description: `Reviewed adviser change request for "${orgName}": ${normalizedStatus}`,
      },
      req,
    });

    res.json({ message: `Request ${normalizedStatus.toLowerCase()} successfully`, request: changeRequest });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
