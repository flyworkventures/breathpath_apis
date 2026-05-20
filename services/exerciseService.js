/**
 * Exercise CRUD helpers (DB layer).
 */

const db = require('../config/database');

const TITLE_LANGS = ['tr', 'en', 'de', 'ar', 'fr', 'ko', 'ja', 'es', 'it', 'hi', 'pt', 'ru', 'zh'];
const BENEFIT_LANGS = TITLE_LANGS;

async function columnExists(table, column) {
  const rows = await db.query(
    `SELECT 1
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?
     LIMIT 1`,
    [table, column]
  );
  return rows.length > 0;
}

function pickLocalized(map, lang) {
  if (!map || typeof map !== 'object') return null;
  if (lang === 'zh') return map.zh ?? map.ch ?? null;
  if (lang === 'ch') return map.ch ?? map.zh ?? null;
  return map[lang] ?? null;
}

function stringifyBenefits(value) {
  if (value == null) return JSON.stringify([]);
  if (typeof value === 'string') return value;
  return JSON.stringify(Array.isArray(value) ? value : []);
}

function stringifySteps(value) {
  if (value == null) return JSON.stringify([]);
  if (typeof value === 'string') return value;
  return JSON.stringify(Array.isArray(value) ? value : []);
}

function validateCreatePayload(body) {
  const errors = [];

  if (!body.category || typeof body.category !== 'string') {
    errors.push('category is required');
  }
  if (!body.tabCategory && !body.tab_category) {
    errors.push('tabCategory is required');
  }
  if (!body.level || typeof body.level !== 'string') {
    errors.push('level is required');
  }

  const title = body.title;
  if (!title || typeof title !== 'object') {
    errors.push('title object is required');
  } else if (!pickLocalized(title, 'tr') && !pickLocalized(title, 'en')) {
    errors.push('title.tr or title.en is required');
  }

  if (body.duration != null && (typeof body.duration !== 'number' || body.duration < 0)) {
    errors.push('duration must be a non-negative number (seconds)');
  }

  return errors;
}

/**
 * Create exercise from mobile/admin API body shape.
 */
async function createExercise(body) {
  const validationErrors = validateCreatePayload(body);
  if (validationErrors.length) {
    const err = new Error(validationErrors.join('; '));
    err.statusCode = 400;
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  const title = body.title || {};
  const benefits = body.benefits || {};
  const explain = body.explain || {};

  const columns = [
    'category',
    'tab_category',
    'level',
    'sub_category',
    'video_image_url',
    'video_url',
    'duration',
    'steps',
    'is_premium',
  ];
  const values = [
    body.category.trim(),
    (body.tabCategory || body.tab_category).trim(),
    body.level.trim(),
    body.subCategory || body.sub_category || null,
    body.videoImageURL || body.video_image_url || null,
    body.videoUrl || body.video_url || null,
    body.duration != null ? body.duration : 180,
    stringifySteps(body.steps),
    body.isPremium || body.is_premium ? 1 : 0,
  ];

  for (const lang of TITLE_LANGS) {
    const col = lang === 'zh' ? 'title_zh' : `title_${lang}`;
    columns.push(col);
    values.push(pickLocalized(title, lang));
  }

  for (const lang of BENEFIT_LANGS) {
    const col = lang === 'zh' ? 'benefits_zh' : `benefits_${lang}`;
    columns.push(col);
    values.push(stringifyBenefits(pickLocalized(benefits, lang)));
  }

  for (const lang of TITLE_LANGS) {
    const col = lang === 'zh' ? 'explain_zh' : `explain_${lang}`;
    columns.push(col);
    values.push(pickLocalized(explain, lang));
  }

  if (await columnExists('exercises', 'panel_status')) {
    columns.push('panel_status');
    values.push(body.panelStatus || body.panel_status || 'published');
  }

  const placeholders = columns.map(() => '?').join(', ');
  const result = await db.query(
    `INSERT INTO exercises (${columns.join(', ')}) VALUES (${placeholders})`,
    values
  );

  return getExerciseRowById(result.insertId);
}

async function getExerciseRowById(id) {
  const rows = await db.query('SELECT * FROM exercises WHERE id = ?', [id]);
  return rows[0] || null;
}

module.exports = {
  createExercise,
  getExerciseRowById,
  validateCreatePayload,
};
