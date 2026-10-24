/**
 * Student Organizations Routes (backend/routes/organizations.js)
 *
 * Links to `organizations` and `organization_advisers` tables in
 * ../database/student_org_db.sql, enforcing `chk_org_scope` and
 * `fk_org_department_college`.
 */
const express = require('express');
const router = express.Router();
const db = require('../db');

const VALID_ORG_TYPES = [
  'STUDENT_COUNCIL',
  'ACADEMIC',
  'RELIGIOUS',
  'CULTURAL',
  'SPORTS_RECREATION',
  'SOCIO_CIVIC',
  'SPECIAL_INTEREST',
  'OTHER',
];

const VALID_ORG_SCOPES = ['UNIVERSITY', 'COLLEGE', 'DEPARTMENT'];
const VALID_ORG_STATUSES = ['PENDING', 'ACTIVE', 'INACTIVE', 'SUSPENDED'];

function normalizeOrgType(input) {
  if (!input) return 'OTHER';
  const upper = String(input).trim().toUpperCase().replace(/[\s/-]+/g, '_');
  if (VALID_ORG_TYPES.includes(upper)) return upper;
  if (upper === 'SPORTS' || upper === 'RECREATION') return 'SPORTS_RECREATION';
  if (upper === 'SOCIOCIVIC') return 'SOCIO_CIVIC';
  if (upper === 'COUNCIL') return 'STUDENT_COUNCIL';
  return 'OTHER';
}

const ORG_SELECT_QUERY = `
  SELECT o.*,
         c.name AS college_name,
         c.acronym AS college_acronym,
         d.name AS department_name,
         d.acronym AS department_acronym,
         oa.adviser_id AS current_adviser_id,
         au.id AS adviser_user_id,
         CASE WHEN au.id IS NOT NULL THEN (au.last_name || ', ' || au.first_name) ELSE NULL END AS adviser_name,
         au.email AS adviser_email,
         cu.email AS created_by_email,
         CASE WHEN cu.id IS NOT NULL THEN (cu.last_name || ', ' || cu.first_name) ELSE NULL END AS created_by_name,
         CASE WHEN apu.id IS NOT NULL THEN (apu.last_name || ', ' || apu.first_name) ELSE NULL END AS approved_by_name,
         (SELECT COUNT(*)::int FROM organization_members om WHERE om.organization_id = o.id AND om.status = 'ACTIVE') AS active_members,
         (SELECT COUNT(*)::int FROM events ev WHERE ev.organization_id = o.id AND ev.status IN ('APPROVED', 'PUBLISHED')) AS upcoming_events_count
    FROM organizations o
    LEFT JOIN colleges c ON c.id = o.college_id
    LEFT JOIN departments d ON d.id = o.department_id
    LEFT JOIN organization_advisers oa ON oa.organization_id = o.id AND oa.ended_at IS NULL
    LEFT JOIN advisers a ON a.id = oa.adviser_id
    LEFT JOIN users au ON au.id = a.user_id
    LEFT JOIN users cu ON cu.id = o.created_by
    LEFT JOIN users apu ON apu.id = o.approved_by
`;

// GET /api/organizations — Fetch organizations with college, department, and current adviser metadata
router.get('/', async (req, res) => {
  try {
    const { status, all, scope, org_type, college_id, department_id } = req.query;
    let queryText = ORG_SELECT_QUERY;
    const conditions = [];
    const params = [];

    if (all !== 'true' && status !== 'ALL') {
      const filterStatus = status || 'ACTIVE';
      params.push(filterStatus);
      conditions.push(`o.status = $${params.length}`);
    }
    if (scope) {
      params.push(String(scope).toUpperCase());
      conditions.push(`o.scope = $${params.length}`);
    }
    if (org_type) {
      params.push(normalizeOrgType(org_type));
      conditions.push(`o.org_type = $${params.length}`);
    }
    if (college_id) {
      params.push(Number(college_id));
      conditions.push(`o.college_id = $${params.length}`);
    }
    if (department_id) {
      params.push(Number(department_id));
      conditions.push(`o.department_id = $${params.length}`);
    }

    if (conditions.length > 0) {
      queryText += ` WHERE ${conditions.join(' AND ')}`;
    }

    queryText += ' ORDER BY o.name ASC';

    const result = await db.query(queryText, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/organizations/:id — Fetch a single organization by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(`${ORG_SELECT_QUERY} WHERE o.id = $1`, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/organizations — Propose/create an organization respecting chk_org_scope in database/student_org_db.sql
router.post('/', async (req, res) => {
  try {
    const {
      name,
      acronym,
      description,
      logo,
      org_type,
      category,
      scope,
      college_id,
      college,
      department_id,
      department,
      created_by,
      adviser_id,
      status,
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Organization name is required' });
    }

    let collegeIdVal = college_id ? Number(college_id) : null;
    let departmentIdVal = department_id ? Number(department_id) : null;

    if (!collegeIdVal && college && college !== 'University-Wide') {
      const colLookup = await db.query(
        'SELECT id FROM colleges WHERE lower(name) = lower($1) OR lower(acronym) = lower($1) LIMIT 1',
        [String(college).trim()]
      );
      if (colLookup.rows.length > 0) collegeIdVal = colLookup.rows[0].id;
    }

    if (!departmentIdVal && department) {
      const deptLookup = await db.query(
        'SELECT id, college_id FROM departments WHERE lower(name) = lower($1) OR lower(acronym) = lower($1) LIMIT 1',
        [String(department).trim()]
      );
      if (deptLookup.rows.length > 0) {
        departmentIdVal = deptLookup.rows[0].id;
        if (!collegeIdVal) collegeIdVal = deptLookup.rows[0].college_id;
      }
    }

    // Infer or normalize scope so it satisfies chk_org_scope in database/student_org_db.sql:
    // UNIVERSITY -> college_id IS NULL AND department_id IS NULL
    // COLLEGE    -> college_id IS NOT NULL AND department_id IS NULL
    // DEPARTMENT -> college_id IS NOT NULL AND department_id IS NOT NULL
    let orgScope = scope ? String(scope).toUpperCase() : null;
    if (!VALID_ORG_SCOPES.includes(orgScope)) {
      if (departmentIdVal && collegeIdVal) orgScope = 'DEPARTMENT';
      else if (collegeIdVal) orgScope = 'COLLEGE';
      else orgScope = 'UNIVERSITY';
    }

    if (orgScope === 'UNIVERSITY') {
      collegeIdVal = null;
      departmentIdVal = null;
    } else if (orgScope === 'COLLEGE') {
      departmentIdVal = null;
      if (!collegeIdVal) {
        const firstCol = await db.query('SELECT id FROM colleges ORDER BY id ASC LIMIT 1');
        if (firstCol.rows.length > 0) {
          collegeIdVal = firstCol.rows[0].id;
        } else {
          orgScope = 'UNIVERSITY';
        }
      }
    } else if (orgScope === 'DEPARTMENT') {
      if (departmentIdVal && !collegeIdVal) {
        const deptRes = await db.query('SELECT college_id FROM departments WHERE id = $1', [departmentIdVal]);
        if (deptRes.rows.length > 0) {
          collegeIdVal = deptRes.rows[0].college_id;
        }
      }
      if (!departmentIdVal || !collegeIdVal) {
        orgScope = collegeIdVal ? 'COLLEGE' : 'UNIVERSITY';
        departmentIdVal = null;
      }
    }

    const orgTypeVal = normalizeOrgType(org_type || category);
    const orgStatusVal = VALID_ORG_STATUSES.includes(String(status || '').toUpperCase())
      ? String(status).toUpperCase()
      : 'PENDING';

    // ============================================================
    // [GOOGLE DRIVE API PLACEHOLDER — ORGANIZATION LOGO UPLOAD]
    // Insert Google Drive API upload logic here to upload the
    // organization logo image to Google Drive and store the
    // resulting Google Drive file URL in `logoUrl`.
    //
    //
    //
    // ============================================================
    const logoUrl = logo || null;

    const insertRes = await db.query(
      `INSERT INTO organizations (
        name, acronym, description, logo, org_type, scope,
        college_id, department_id, created_by, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id`,
      [
        name.trim(),
        acronym ? acronym.trim() : null,
        description || null,
        logoUrl,
        orgTypeVal,
        orgScope,
        collegeIdVal,
        departmentIdVal,
        created_by || null,
        orgStatusVal,
      ]
    );

    const createdOrgId = insertRes.rows[0].id;

    // Optionally link an initial adviser in organization_advisers
    if (adviser_id) {
      try {
        await db.query(
          `INSERT INTO organization_advisers (organization_id, adviser_id, assigned_by)
           VALUES ($1, $2, $3)`,
          [createdOrgId, adviser_id, created_by || null]
        );
      } catch (advErr) {
        console.warn('Notice: Could not link adviser to organization:', advErr.message);
      }
    }

    const fullOrg = await db.query(`${ORG_SELECT_QUERY} WHERE o.id = $1`, [createdOrgId]);
    res.status(201).json(fullOrg.rows[0]);
  } catch (err) {
    console.error(err);
    if (err.code === '23505') {
      return res.status(409).json({ error: 'An organization with this name/acronym already exists in that scope' });
    }
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

// PUT /api/organizations/:id/approve — Approve or change status of an organization
router.put('/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const { approved_by, status } = req.body || {};
    const targetStatus = VALID_ORG_STATUSES.includes(String(status || '').toUpperCase())
      ? String(status).toUpperCase()
      : 'ACTIVE';

    const result = await db.query(
      `UPDATE organizations
          SET status = $2,
              approved_by = COALESCE($3, approved_by),
              approved_at = CASE WHEN $2 = 'ACTIVE' THEN now() ELSE approved_at END,
              updated_at = now()
        WHERE id = $1
        RETURNING id`,
      [id, targetStatus, approved_by || null]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const fullOrg = await db.query(`${ORG_SELECT_QUERY} WHERE o.id = $1`, [id]);
    res.json(fullOrg.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/organizations/:id — Update organization profile, academic scope, adviser, or logo
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      acronym,
      description,
      logo,
      org_type,
      category,
      scope,
      college_id,
      department_id,
      status,
      approved_by,
      adviser_id,
    } = req.body;

    const existingRes = await db.query('SELECT * FROM organizations WHERE id = $1', [id]);
    if (existingRes.rows.length === 0) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    const current = existingRes.rows[0];

    let nextScope = scope ? String(scope).toUpperCase() : current.scope;
    if (!VALID_ORG_SCOPES.includes(nextScope)) nextScope = current.scope;

    let nextCollegeId = college_id !== undefined ? (college_id ? Number(college_id) : null) : current.college_id;
    let nextDepartmentId = department_id !== undefined ? (department_id ? Number(department_id) : null) : current.department_id;

    if (nextScope === 'UNIVERSITY') {
      nextCollegeId = null;
      nextDepartmentId = null;
    } else if (nextScope === 'COLLEGE') {
      nextDepartmentId = null;
      if (!nextCollegeId) nextScope = 'UNIVERSITY';
    } else if (nextScope === 'DEPARTMENT') {
      if (nextDepartmentId && !nextCollegeId) {
        const deptRes = await db.query('SELECT college_id FROM departments WHERE id = $1', [nextDepartmentId]);
        if (deptRes.rows.length > 0) nextCollegeId = deptRes.rows[0].college_id;
      }
      if (!nextDepartmentId || !nextCollegeId) {
        nextScope = nextCollegeId ? 'COLLEGE' : 'UNIVERSITY';
        nextDepartmentId = null;
      }
    }

    const nextOrgType = (org_type || category) ? normalizeOrgType(org_type || category) : current.org_type;
    const nextStatus = status && VALID_ORG_STATUSES.includes(String(status).toUpperCase())
      ? String(status).toUpperCase()
      : current.status;

    // ============================================================
    // [GOOGLE DRIVE API PLACEHOLDER — UPDATE ORGANIZATION LOGO]
    // Insert Google Drive API image upload / replacement logic here
    // when updating an organization's logo image.
    //
    //
    //
    // ============================================================
    const nextLogo = logo !== undefined ? logo : current.logo;

    await db.query(
      `UPDATE organizations
          SET name = $2,
              acronym = $3,
              description = $4,
              logo = $5,
              org_type = $6,
              scope = $7,
              college_id = $8,
              department_id = $9,
              status = $10,
              approved_by = COALESCE($11, approved_by),
              approved_at = CASE WHEN $10 = 'ACTIVE' AND approved_at IS NULL THEN now() ELSE approved_at END,
              updated_at = now()
        WHERE id = $1`,
      [
        id,
        name ? name.trim() : current.name,
        acronym !== undefined ? (acronym ? acronym.trim() : null) : current.acronym,
        description !== undefined ? description : current.description,
        nextLogo,
        nextOrgType,
        nextScope,
        nextCollegeId,
        nextDepartmentId,
        nextStatus,
        approved_by || null,
      ]
    );

    if (adviser_id) {
      await db.query(
        'UPDATE organization_advisers SET ended_at = now() WHERE organization_id = $1 AND ended_at IS NULL',
        [id]
      );
      await db.query(
        `INSERT INTO organization_advisers (organization_id, adviser_id, assigned_by)
         VALUES ($1, $2, $3)`,
        [id, adviser_id, approved_by || null]
      );
    }

    const fullOrg = await db.query(`${ORG_SELECT_QUERY} WHERE o.id = $1`, [id]);
    res.json(fullOrg.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

module.exports = router;
