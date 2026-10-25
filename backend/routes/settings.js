/**
 * System Settings REST Routes (backend/routes/settings.js)
 *
 * Manages university-wide SOMS configuration including organization categories,
 * academic periods, and system preferences in the `system_settings` table.
 */
const express = require('express');
const router = express.Router();
const db = require('../db');

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
    emailNotifications: true,
    smsNotifications: false,
    applicationAlerts: true,
    eventReminders: true,
    reportDeadlines: true,
  },
};

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
    let settings = DEFAULT_SETTINGS;
    if (row.rows.length > 0 && row.rows[0].value) {
      settings = { ...DEFAULT_SETTINGS, ...row.rows[0].value };
    }

    const categories = await getEffectiveCategories(settings.organizationCategories);
    settings.organizationCategories = categories;

    res.json(settings);
  } catch (err) {
    console.error('Error fetching settings:', err);
    res.status(500).json({ error: 'Failed to retrieve settings' });
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
    const newSettings = req.body || {};
    
    // Normalize categories if provided
    if (Array.isArray(newSettings.organizationCategories)) {
      newSettings.organizationCategories = [
        ...new Set(newSettings.organizationCategories.map((c) => String(c).trim()).filter(Boolean)),
      ];
    }

    const existingRow = await db.query(`SELECT value FROM system_settings WHERE key = 'admin_settings'`);
    const existingVal = existingRow.rows[0]?.value || DEFAULT_SETTINGS;
    const merged = { ...existingVal, ...newSettings };

    const saveRes = await db.query(
      `INSERT INTO system_settings (key, value, updated_at)
       VALUES ('admin_settings', $1, now())
       ON CONFLICT (key) DO UPDATE
         SET value = EXCLUDED.value,
             updated_at = now()
       RETURNING value`,
      [JSON.stringify(merged)]
    );

    // Optional audit log
    const actorId = req.body.userId || req.body.actorId || null;
    await db.query(
      `INSERT INTO audit_logs (user_id, action, entity, metadata)
       VALUES ($1, 'SETTINGS_UPDATED', 'settings', $2)`,
      [actorId, JSON.stringify({ updatedKeys: Object.keys(newSettings) })]
    ).catch(() => {});

    res.json(saveRes.rows[0]?.value || merged);
  } catch (err) {
    console.error('Error saving settings:', err);
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

module.exports = router;
