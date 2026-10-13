const express = require('express');
const router = express.Router();
const db = require('../db');

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
              u.last_name,
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

router.post('/assign', async (req, res) => {
  try {
    const { organization_id, adviser_id, assigned_by } = req.body;

    if (!organization_id || !adviser_id) {
      return res.status(400).json({ error: 'organization_id and adviser_id are required' });
    }

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

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/requests', async (req, res) => {
  try {
    const { status, organization_id } = req.query;
    let queryText = `
      SELECT acr.*,
             o.name AS organization_name,
             o.acronym AS organization_acronym,
             cu.first_name AS current_adviser_first_name,
             cu.last_name  AS current_adviser_last_name,
             pu.first_name AS proposed_adviser_first_name,
             pu.last_name  AS proposed_adviser_last_name,
             req_user.first_name AS requester_first_name,
             req_user.last_name  AS requester_last_name
        FROM adviser_change_requests acr
        JOIN organizations o ON o.id = acr.organization_id
   LEFT JOIN advisers ca     ON ca.id = acr.current_adviser_id
   LEFT JOIN users cu        ON cu.id = ca.user_id
   LEFT JOIN advisers pa     ON pa.id = acr.proposed_adviser_id
   LEFT JOIN users pu        ON pu.id = pa.user_id
   LEFT JOIN users req_user  ON req_user.id = acr.requested_by
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

router.post('/requests', async (req, res) => {
  try {
    const { organization_id, proposed_adviser_id, requested_by, reason } = req.body;

    if (!organization_id || !proposed_adviser_id || !reason) {
      return res.status(400).json({
        error: 'organization_id, proposed_adviser_id, and reason are required',
      });
    }

    const currentAdvRes = await db.query(
      'SELECT adviser_id FROM organization_advisers WHERE organization_id = $1 AND ended_at IS NULL',
      [organization_id]
    );
    const currentAdviserId = currentAdvRes.rows.length > 0 ? currentAdvRes.rows[0].adviser_id : null;

    if (currentAdviserId === proposed_adviser_id) {
      return res.status(400).json({ error: 'Proposed adviser is already the current adviser' });
    }

    const result = await db.query(
      `INSERT INTO adviser_change_requests (
        organization_id, current_adviser_id, proposed_adviser_id, requested_by, reason, status
      ) VALUES ($1, $2, $3, $4, $5, 'PENDING')
      RETURNING *`,
      [organization_id, currentAdviserId, proposed_adviser_id, requested_by || null, reason.trim()]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A pending adviser change request already exists for this organization' });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/requests/:id/review', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reviewed_by, review_remarks } = req.body;

    if (!['APPROVED', 'REJECTED'].includes(status)) {
      return res.status(400).json({ error: "status must be 'APPROVED' or 'REJECTED'" });
    }

    const reqResult = await db.query(
      `UPDATE adviser_change_requests
          SET status = $2,
              reviewed_by = $3,
              review_remarks = $4,
              reviewed_at = now()
        WHERE id = $1 AND status = 'PENDING'
        RETURNING *`,
      [id, status, reviewed_by || null, review_remarks || null]
    );

    if (reqResult.rows.length === 0) {
      return res.status(404).json({ error: 'Request not found or already reviewed' });
    }

    const changeRequest = reqResult.rows[0];

    if (status === 'APPROVED' && changeRequest.proposed_adviser_id) {
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

    res.json({ message: `Request ${status.toLowerCase()} successfully`, request: changeRequest });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
