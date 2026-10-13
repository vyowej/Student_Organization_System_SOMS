const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT o.*,
             c.name as college_name,
             d.name as department_name
        FROM organizations o
   LEFT JOIN colleges c ON c.id = o.college_id
   LEFT JOIN departments d ON d.id = o.department_id
       WHERE o.status = 'ACTIVE'
       ORDER BY o.name ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const {
      name,
      acronym,
      description,
      logo,
      org_type,
      scope,
      college_id,
      department_id,
      created_by,
      adviser_id,
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Organization name is required' });
    }

    const collegeIdVal = college_id || null;
    const departmentIdVal = department_id || null;

    let orgScope = scope;
    if (!orgScope) {
      if (departmentIdVal && collegeIdVal) orgScope = 'DEPARTMENT';
      else if (collegeIdVal) orgScope = 'COLLEGE';
      else orgScope = 'UNIVERSITY';
    }

    const orgTypeVal = org_type || 'OTHER';

    const result = await db.query(
      `INSERT INTO organizations (
        name, acronym, description, logo, org_type, scope,
        college_id, department_id, created_by, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'PENDING')
      RETURNING *`,
      [
        name.trim(),
        acronym ? acronym.trim() : null,
        description || null,
        logo || null,
        orgTypeVal,
        orgScope,
        collegeIdVal,
        departmentIdVal,
        created_by || null,
      ]
    );

    const createdOrg = result.rows[0];

    if (adviser_id) {
      try {
        await db.query(
          `INSERT INTO organization_advisers (organization_id, adviser_id, assigned_by)
           VALUES ($1, $2, $3)`,
          [createdOrg.id, adviser_id, created_by || null]
        );
      } catch (advErr) {
        console.warn('Notice: Could not link adviser to organization:', advErr.message);
      }
    }

    res.status(201).json(createdOrg);
  } catch (err) {
    console.error(err);
    if (err.code === '23505') {
      return res.status(409).json({ error: 'An organization with this name/acronym already exists' });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const { approved_by } = req.body || {};
    const result = await db.query(
      `UPDATE organizations
          SET status = 'ACTIVE',
              approved_by = COALESCE($2, approved_by),
              approved_at = now(),
              updated_at = now()
        WHERE id = $1
        RETURNING *`,
      [id, approved_by || null]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
