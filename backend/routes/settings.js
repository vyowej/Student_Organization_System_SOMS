/**
 * System Settings REST Routes (backend/routes/settings.js)
 *
 * Manages university-wide SOMS configuration including organization categories,
 * academic periods, and system preferences in the `system_settings` table.
 */
const express = require('express');
const router = express.Router();
const db = require('../db');
const { recordAuditLog } = require('../notificationsHelper');

const DEFAULT_CATEGORIES = [
  'Academic',
  'Technology',
  'Leadership',
  'Student Council',
  'Socio-Civic',
  'Cultural',
  'Sports & Recreation',
  'Sports',
  'Religious',
  'Special Interest',
  'Publication',
  'Other',
];

const DEFAULT_SETTINGS = {
  academicYear: '2026-2027',
  semester: 'First Semester',
  allowOrganizationApplications: true,
  requireAdviserApproval: true,
  maintenanceMode: false,
  organizationCategories: DEFAULT_CATEGORIES,
  notifications: {
    organizationApplications: true,
    eventApprovals: true,
    documentReviews: true,
    securityAlerts: true,
  },
};

const DEFAULT_OFFICER_NOTIFICATION_PREFS = {
  membershipRequests: true,
  eventUpdates: true,
  documentUpdates: true,
  adviserApprovalUpdates: true,
  studentAnnouncements: true,
};

function sanitizeAdminNotifications(rawNotifications) {
  const src = rawNotifications && typeof rawNotifications === 'object' ? rawNotifications : {};
  return {
    organizationApplications: src.organizationApplications !== undefined
      ? Boolean(src.organizationApplications)
      : src.applicationAlerts !== undefined
        ? Boolean(src.applicationAlerts)
        : true,
    eventApprovals: src.eventApprovals !== undefined
      ? Boolean(src.eventApprovals)
      : src.eventReminders !== undefined
        ? Boolean(src.eventReminders)
        : true,
    documentReviews: src.documentReviews !== undefined
      ? Boolean(src.documentReviews)
      : src.reportDeadlines !== undefined
        ? Boolean(src.reportDeadlines)
        : true,
    securityAlerts: src.securityAlerts !== undefined
      ? Boolean(src.securityAlerts)
      : src.emailNotifications !== undefined
        ? Boolean(src.emailNotifications)
        : true,
  };
}

function sanitizeAdminSettingsPayload(val = {}) {
  const clean = { ...DEFAULT_SETTINGS, ...val };
  delete clean.userId;
  delete clean.actorId;
  delete clean.user_id;
  delete clean.updated_by;
  clean.notifications = sanitizeAdminNotifications(val.notifications);
  return clean;
}

/**
 * Ensures system_settings table exists
 */
async function ensureSettingsTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS system_settings (
      key         VARCHAR(100) PRIMARY KEY,
      value       JSONB NOT NULL,
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

/**
 * Combines categories from saved settings, defaults, and organizations in DB
 */
async function getEffectiveCategories(savedCategories = []) {
  try {
    const orgsCatRes = await db.query(
      `SELECT DISTINCT category FROM organizations WHERE category IS NOT NULL AND TRIM(category) <> '' ORDER BY category ASC`
    );
    const orgCats = orgsCatRes.rows.map((r) => r.category.trim());
    const base = Array.isArray(savedCategories) && savedCategories.length > 0
      ? savedCategories
      : DEFAULT_CATEGORIES;
    return [...new Set([...base, ...orgCats])];
  } catch {
    return Array.isArray(savedCategories) && savedCategories.length > 0 ? savedCategories : DEFAULT_CATEGORIES;
  }
}

/**
 * GET /api/settings
 * Returns the current system settings.
 */
router.get('/', async (req, res) => {
  try {
    await ensureSettingsTable();
    const row = await db.query(`SELECT value FROM system_settings WHERE key = 'admin_settings'`);
    const settings = sanitizeAdminSettingsPayload(row.rows[0]?.value || {});

    const categories = await getEffectiveCategories(settings.organizationCategories);
    settings.organizationCategories = categories;

    res.json(settings);
  } catch (err) {
    console.error('Error fetching settings:', err);
    res.status(500).json({ error: 'Failed to retrieve settings' });
  }
});

/**
 * GET /api/settings/organization/:orgId/preferences
 * Returns officer notification preferences persisted in PostgreSQL system_settings.
 */
router.get('/organization/:orgId/preferences', async (req, res) => {
  try {
    await ensureSettingsTable();
    const orgId = String(req.params.orgId || 'default').replace(/[^a-zA-Z0-9_-]/g, '');
    const key = `officer_prefs_${orgId || 'default'}`;
    const row = await db.query('SELECT value FROM system_settings WHERE key = $1', [key]);
    const saved = row.rows[0]?.value && typeof row.rows[0].value === 'object' ? row.rows[0].value : {};
    res.json({ ...DEFAULT_OFFICER_NOTIFICATION_PREFS, ...saved });
  } catch (err) {
    console.error('Error fetching organization preferences:', err);
    res.status(500).json({ error: 'Failed to retrieve organization notification preferences' });
  }
});

/**
 * PUT /api/settings/organization/:orgId/preferences
 * Updates and persists officer notification preferences in PostgreSQL system_settings.
 */
router.put('/organization/:orgId/preferences', async (req, res) => {
  try {
    await ensureSettingsTable();
    const orgId = String(req.params.orgId || 'default').replace(/[^a-zA-Z0-9_-]/g, '');
    const key = `officer_prefs_${orgId || 'default'}`;
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const actorId = body.userId || body.user_id || body.updated_by || null;
    const sanitized = {
      membershipRequests: body.membershipRequests !== undefined ? Boolean(body.membershipRequests) : true,
      eventUpdates: body.eventUpdates !== undefined ? Boolean(body.eventUpdates) : true,
      documentUpdates: body.documentUpdates !== undefined ? Boolean(body.documentUpdates) : true,
      adviserApprovalUpdates: body.adviserApprovalUpdates !== undefined ? Boolean(body.adviserApprovalUpdates) : true,
      studentAnnouncements: body.studentAnnouncements !== undefined ? Boolean(body.studentAnnouncements) : true,
    };

    const saveRes = await db.query(
      `INSERT INTO system_settings (key, value, updated_at)
       VALUES ($1, $2, now())
       ON CONFLICT (key) DO UPDATE
         SET value = EXCLUDED.value,
             updated_at = now()
       RETURNING value`,
      [key, JSON.stringify(sanitized)]
    );

    await recordAuditLog({
      userId: actorId,
      action: 'OFFICER_PREFERENCES_UPDATED',
      entity: 'settings',
      entityId: Number.isFinite(Number(orgId)) ? Number(orgId) : null,
      metadata: {
        organization_id: orgId,
        preferences: sanitized,
        description: `Updated notification preferences for organization #${orgId}`,
      },
      req,
    }).catch(() => {});

    res.json(saveRes.rows[0]?.value || sanitized);
  } catch (err) {
    console.error('Error saving organization preferences:', err);
    res.status(500).json({ error: 'Failed to save organization notification preferences' });
  }
});

/**
 * GET /api/settings/categories
 * Returns the current organization categories.
 */
router.get('/categories', async (req, res) => {
  try {
    await ensureSettingsTable();
    const row = await db.query(`SELECT value FROM system_settings WHERE key = 'admin_settings'`);
    const savedCategories = row.rows[0]?.value?.organizationCategories || [];
    const categories = await getEffectiveCategories(savedCategories);
    res.json({ categories });
  } catch (err) {
    console.error('Error fetching categories:', err);
    res.json({ categories: DEFAULT_CATEGORIES });
  }
});

/**
 * PUT /api/settings
 * Updates and persists system settings.
 */
router.put('/', async (req, res) => {
  try {
    await ensureSettingsTable();
    const rawSettings = { ...(req.body || {}) };
    if (rawSettings.academic_year && !rawSettings.academicYear) {
      rawSettings.academicYear = rawSettings.academic_year;
    }
    delete rawSettings.academic_year;
    const actorId = rawSettings.userId || rawSettings.actorId || rawSettings.user_id || rawSettings.updated_by || null;
    delete rawSettings.userId;
    delete rawSettings.actorId;
    delete rawSettings.user_id;
    delete rawSettings.updated_by;

    const newSettings = rawSettings;
    
    // Normalize categories if provided
    if (Array.isArray(newSettings.organizationCategories)) {
      newSettings.organizationCategories = [
        ...new Set(newSettings.organizationCategories.map((c) => String(c).trim()).filter(Boolean)),
      ];
    }

    const existingRow = await db.query(`SELECT value FROM system_settings WHERE key = 'admin_settings'`);
    const existingVal = sanitizeAdminSettingsPayload(existingRow.rows[0]?.value || {});
    const merged = sanitizeAdminSettingsPayload({ ...existingVal, ...newSettings });

    const saveRes = await db.query(
      `INSERT INTO system_settings (key, value, updated_at)
       VALUES ('admin_settings', $1, now())
       ON CONFLICT (key) DO UPDATE
         SET value = EXCLUDED.value,
             updated_at = now()
       RETURNING value`,
      [JSON.stringify(merged)]
    );

    // Audit log
    await recordAuditLog({
      userId: actorId,
      action: 'SETTINGS_UPDATED',
      entity: 'settings',
      entityId: null,
      metadata: {
        updatedKeys: Object.keys(newSettings),
        description: `Updated system settings (${Object.keys(newSettings).join(', ')})`,
      },
      req,
    }).catch(() => {});

    res.json(saveRes.rows[0]?.value || merged);
  } catch (err) {
    console.error('Error saving settings:', err);
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

module.exports = router;
