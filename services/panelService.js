/**
 * App Panel — database access and business rules.
 */

const db = require('../config/database');
const logger = require('../utils/logger');
const {
  mapPanelUser,
  mapPanelWorkout,
  mapPanelUserWorkout,
  paginationMeta,
  parseJson,
  minutesToSeconds,
} = require('../utils/panelMappers');

let schemaCache = {
  exercisesPanelStatus: null,
  completionEvents: null,
};

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

async function tableExists(table) {
  const rows = await db.query(
    `SELECT 1
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
     LIMIT 1`,
    [table]
  );
  return rows.length > 0;
}

async function hasExercisesPanelStatus() {
  if (schemaCache.exercisesPanelStatus === null) {
    schemaCache.exercisesPanelStatus = await columnExists('exercises', 'panel_status');
  }
  return schemaCache.exercisesPanelStatus;
}

async function hasCompletionEventsTable() {
  if (schemaCache.completionEvents === null) {
    schemaCache.completionEvents = await tableExists('exercise_completion_events');
  }
  return schemaCache.completionEvents;
}

function getTimezone() {
  return process.env.PANEL_TIMEZONE || 'Europe/Istanbul';
}

function getDailyDays() {
  const n = parseInt(process.env.PANEL_DAILY_DAYS, 10);
  if (Number.isNaN(n) || n < 7) return 30;
  return Math.min(n, 90);
}

function panelDateSql(column) {
  const tz = getTimezone();
  return `DATE(CONVERT_TZ(${column}, '+00:00', ?))`;
}

async function getAnalyse() {
  const tz = getTimezone();
  const days = getDailyDays();
  const hasStatus = await hasExercisesPanelStatus();
  const hasEvents = await hasCompletionEventsTable();

  const [userTotalsRows] = await db.query(
    `SELECT
      COUNT(*) AS totalUsers,
      SUM(CASE WHEN ${panelDateSql('last_active')} = ${panelDateSql('UTC_TIMESTAMP()')} THEN 1 ELSE 0 END) AS loginsToday,
      SUM(CASE WHEN ${panelDateSql('account_created_date')} = ${panelDateSql('UTC_TIMESTAMP()')} THEN 1 ELSE 0 END) AS newUsersToday
    FROM users
    WHERE is_active = TRUE`,
    [tz, tz, tz, tz]
  );
  const userTotals = userTotalsRows[0] || {};

  let workoutTotals = {
    totalWorkouts: 0,
    publishedWorkouts: 0,
    workoutsCompletedToday: 0,
    activeWorkoutUsersToday: 0,
  };

  if (hasStatus) {
    const [wRows] = await db.query(
      `SELECT
        COUNT(*) AS totalWorkouts,
        SUM(CASE WHEN panel_status = 'published' THEN 1 ELSE 0 END) AS publishedWorkouts
      FROM exercises
      WHERE COALESCE(panel_status, 'published') != 'archived'`
    );
    const w = wRows[0] || {};
    workoutTotals.totalWorkouts = Number(w.totalWorkouts || 0);
    workoutTotals.publishedWorkouts = Number(w.publishedWorkouts || 0);
  } else {
    const [wRows] = await db.query('SELECT COUNT(*) AS totalWorkouts FROM exercises');
    workoutTotals.totalWorkouts = Number(wRows[0]?.totalWorkouts || 0);
    workoutTotals.publishedWorkouts = workoutTotals.totalWorkouts;
  }

  if (hasEvents) {
    const [eRows] = await db.query(
      `SELECT
        COUNT(*) AS workoutsCompletedToday,
        COUNT(DISTINCT uid) AS activeWorkoutUsersToday
      FROM exercise_completion_events
      WHERE status = 'completed'
        AND ${panelDateSql('completed_at')} = ${panelDateSql('UTC_TIMESTAMP()')}`,
      [tz, tz]
    );
    const e = eRows[0] || {};
    workoutTotals.workoutsCompletedToday = Number(e.workoutsCompletedToday || 0);
    workoutTotals.activeWorkoutUsersToday = Number(e.activeWorkoutUsersToday || 0);
  } else {
    const [eRows] = await db.query(
      `SELECT
        COUNT(*) AS activeWorkoutUsersToday
      FROM users
      WHERE is_active = TRUE
        AND last_exercise_date IS NOT NULL
        AND ${panelDateSql('last_exercise_date')} = ${panelDateSql('UTC_TIMESTAMP()')}`,
      [tz, tz]
    );
    workoutTotals.activeWorkoutUsersToday = Number(eRows[0]?.activeWorkoutUsersToday || 0);
  }

  const dailyUsers = await db.query(
    `SELECT
      ${panelDateSql('account_created_date')} AS date,
      COUNT(*) AS newUsers
    FROM users
    WHERE is_active = TRUE
      AND account_created_date >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? DAY)
    GROUP BY date
    ORDER BY date ASC`,
    [tz, days]
  );

  const dailyLogins = await db.query(
    `SELECT
      ${panelDateSql('last_active')} AS date,
      COUNT(*) AS logins
    FROM users
    WHERE is_active = TRUE
      AND last_active IS NOT NULL
      AND last_active >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? DAY)
    GROUP BY date
    ORDER BY date ASC`,
    [tz, days]
  );

  let dailyCompletions = [];
  if (hasEvents) {
    dailyCompletions = await db.query(
      `SELECT
        ${panelDateSql('completed_at')} AS date,
        COUNT(*) AS workoutsCompleted,
        COALESCE(SUM(duration_seconds), 0) AS workoutSeconds
      FROM exercise_completion_events
      WHERE status = 'completed'
        AND completed_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? DAY)
      GROUP BY date
      ORDER BY date ASC`,
      [tz, days]
    );
  }

  const dateMap = new Map();
  const addRow = (date, patch) => {
    const key = date instanceof Date
      ? date.toISOString().split('T')[0]
      : String(date).split('T')[0];
    const prev = dateMap.get(key) || {
      date: key,
      logins: 0,
      newUsers: 0,
      workoutsCompleted: 0,
      workoutMinutes: 0,
    };
    dateMap.set(key, { ...prev, ...patch, date: key });
  };

  dailyUsers.forEach((r) => addRow(r.date, { newUsers: Number(r.newUsers) }));
  dailyLogins.forEach((r) => addRow(r.date, { logins: Number(r.logins) }));
  dailyCompletions.forEach((r) =>
    addRow(r.date, {
      workoutsCompleted: Number(r.workoutsCompleted),
      workoutMinutes: Math.round(Number(r.workoutSeconds) / 60),
    })
  );

  const daily = Array.from(dateMap.values()).sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  let topWorkouts = [];
  if (hasEvents) {
    topWorkouts = await db.query(
      `SELECT
        e.exercise_id AS workoutId,
        COALESCE(ex.title_en, ex.title_tr, CONCAT('Exercise #', e.exercise_id)) AS title,
        COUNT(*) AS completions
      FROM exercise_completion_events e
      LEFT JOIN exercises ex ON ex.id = e.exercise_id
      WHERE e.status = 'completed'
        AND e.completed_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? DAY)
      GROUP BY e.exercise_id, ex.title_en, ex.title_tr
      ORDER BY completions DESC
      LIMIT 5`,
      [days]
    );
  }

  return {
    summary: {
      totalUsers: Number(userTotals?.totalUsers || 0),
      loginsToday: Number(userTotals?.loginsToday || 0),
      newUsersToday: Number(userTotals?.newUsersToday || 0),
      totalWorkouts: workoutTotals.totalWorkouts,
      publishedWorkouts: workoutTotals.publishedWorkouts,
      workoutsCompletedToday: workoutTotals.workoutsCompletedToday,
      activeWorkoutUsersToday: workoutTotals.activeWorkoutUsersToday,
    },
    daily,
    workoutsSummary: topWorkouts.length
      ? {
          topWorkoutsByCompletions: topWorkouts.map((r) => ({
            workoutId: String(r.workoutId),
            title: r.title,
            completions: Number(r.completions),
          })),
        }
      : undefined,
  };
}

async function listUsers({ page, limit, search }) {
  const offset = (page - 1) * limit;
  const params = [];
  let where = 'WHERE 1=1';

  if (search) {
    where += ' AND (uid LIKE ? OR email LIKE ? OR username LIKE ?)';
    const q = `%${search}%`;
    params.push(q, q, q);
  }

  const [countRows] = await db.query(
    `SELECT COUNT(*) AS total FROM users ${where}`,
    params
  );
  const total = countRows[0]?.total || 0;

  const rows = await db.query(
    `SELECT * FROM users ${where} ORDER BY account_created_date DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return {
    data: rows.map(mapPanelUser),
    pagination: paginationMeta(page, limit, Number(total)),
  };
}

async function getUserById(uid) {
  const rows = await db.query('SELECT * FROM users WHERE uid = ?', [uid]);
  if (!rows.length) return null;
  return mapPanelUser(rows[0]);
}

async function patchUser(uid, body) {
  const existing = await db.query('SELECT * FROM users WHERE uid = ?', [uid]);
  if (!existing.length) return null;

  const updates = [];
  const values = [];

  if (body.displayName !== undefined) {
    updates.push('username = ?');
    values.push(body.displayName);
  }
  if (body.email !== undefined) {
    updates.push('email = ?');
    values.push(body.email);
  }
  if (body.status !== undefined) {
    const active = body.status === 'active';
    updates.push('is_active = ?');
    values.push(active);
  }

  const extras = body.extras || {};
  if (extras.isPremium !== undefined) {
    updates.push('premium_datas = ?');
    values.push(JSON.stringify(extras.isPremium ? [{ source: 'panel' }] : []));
  }

  if (!updates.length) {
    return mapPanelUser(existing[0]);
  }

  values.push(uid);
  await db.query(`UPDATE users SET ${updates.join(', ')} WHERE uid = ?`, values);

  return getUserById(uid);
}

function workoutListWhere(filters, hasStatus) {
  const params = [];
  const clauses = [];

  if (filters.search) {
    clauses.push(
      '(title_en LIKE ? OR title_tr LIKE ? OR category LIKE ? OR CAST(id AS CHAR) LIKE ?)'
    );
    const q = `%${filters.search}%`;
    params.push(q, q, q, q);
  }
  if (filters.category) {
    clauses.push('category = ?');
    params.push(filters.category);
  }
  if (filters.difficulty) {
    clauses.push('level = ?');
    params.push(filters.difficulty);
  }
  if (filters.status && hasStatus) {
    clauses.push('panel_status = ?');
    params.push(filters.status);
  } else if (filters.status === 'published' && !hasStatus) {
    // all rows treated as published when column missing
  } else if (filters.status === 'archived' && !hasStatus) {
    clauses.push('1 = 0');
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  return { where, params };
}

async function listWorkouts(filters) {
  const { page, limit } = filters;
  const offset = (page - 1) * limit;
  const hasStatus = await hasExercisesPanelStatus();
  const { where, params } = workoutListWhere(filters, hasStatus);

  const [countRows] = await db.query(
    `SELECT COUNT(*) AS total FROM exercises ${where}`,
    params
  );
  const total = countRows[0]?.total || 0;

  const rows = await db.query(
    `SELECT * FROM exercises ${where} ORDER BY id DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return {
    data: rows.map(mapPanelWorkout),
    pagination: paginationMeta(page, limit, Number(total)),
  };
}

async function getWorkoutById(id) {
  const rows = await db.query('SELECT * FROM exercises WHERE id = ?', [id]);
  if (!rows.length) return null;
  return mapPanelWorkout(rows[0]);
}

async function createWorkout(body) {
  const hasStatus = await hasExercisesPanelStatus();
  const titles = body.extras?.localizedTitles || {};
  const title = body.title || titles.en || titles.tr;
  if (!title) {
    const err = new Error('title is required');
    err.statusCode = 400;
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  const durationSeconds =
    body.durationMinutes != null
      ? minutesToSeconds(body.durationMinutes)
      : null;

  const columns = [
    'category',
    'tab_category',
    'level',
    'video_image_url',
    'video_url',
    'sub_category',
    'title_tr',
    'title_en',
    'duration',
    'explain_en',
    'explain_tr',
    'steps',
    'is_premium',
  ];
  const values = [
    body.category || body.extras?.tabCategory || 'general',
    body.extras?.tabCategory || null,
    body.difficulty || 'start',
    body.coverImageUrl || null,
    body.extras?.videoUrl || null,
    body.extras?.subCategory || null,
    titles.tr || title,
    titles.en || title,
    durationSeconds || 180,
    body.description || null,
    body.extras?.localizedExplain?.tr || null,
    JSON.stringify(body.extras?.steps || []),
    body.extras?.isPremium ? 1 : 0,
  ];

  if (hasStatus) {
    columns.push('panel_status');
    values.push(body.status || 'published');
  }

  const placeholders = columns.map(() => '?').join(', ');
  const result = await db.query(
    `INSERT INTO exercises (${columns.join(', ')}) VALUES (${placeholders})`,
    values
  );

  return getWorkoutById(result.insertId);
}

async function patchWorkout(id, body) {
  const existing = await db.query('SELECT * FROM exercises WHERE id = ?', [id]);
  if (!existing.length) return null;

  const hasStatus = await hasExercisesPanelStatus();
  const updates = [];
  const values = [];

  if (body.title !== undefined) {
    updates.push('title_en = ?');
    values.push(body.title);
  }
  if (body.description !== undefined) {
    updates.push('explain_en = ?');
    values.push(body.description);
  }
  if (body.category !== undefined) {
    updates.push('category = ?');
    values.push(body.category);
  }
  if (body.difficulty !== undefined) {
    updates.push('level = ?');
    values.push(body.difficulty);
  }
  if (body.coverImageUrl !== undefined) {
    updates.push('video_image_url = ?');
    values.push(body.coverImageUrl);
  }
  if (body.durationMinutes !== undefined) {
    updates.push('duration = ?');
    values.push(minutesToSeconds(body.durationMinutes));
  }
  if (body.extras?.videoUrl !== undefined) {
    updates.push('video_url = ?');
    values.push(body.extras.videoUrl);
  }
  if (body.extras?.isPremium !== undefined) {
    updates.push('is_premium = ?');
    values.push(body.extras.isPremium ? 1 : 0);
  }
  if (body.extras?.localizedTitles?.tr !== undefined) {
    updates.push('title_tr = ?');
    values.push(body.extras.localizedTitles.tr);
  }
  if (body.extras?.localizedTitles?.en !== undefined) {
    updates.push('title_en = ?');
    values.push(body.extras.localizedTitles.en);
  }
  if (hasStatus && body.status !== undefined) {
    updates.push('panel_status = ?');
    values.push(body.status);
  }

  if (!updates.length) {
    return mapPanelWorkout(existing[0]);
  }

  values.push(id);
  await db.query(`UPDATE exercises SET ${updates.join(', ')} WHERE id = ?`, values);
  return getWorkoutById(id);
}

async function deleteWorkout(id) {
  const hasStatus = await hasExercisesPanelStatus();
  const existing = await db.query('SELECT id FROM exercises WHERE id = ?', [id]);
  if (!existing.length) return false;

  if (hasStatus) {
    await db.query(
      `UPDATE exercises SET panel_status = 'archived' WHERE id = ?`,
      [id]
    );
  } else {
    await db.query('DELETE FROM exercises WHERE id = ?', [id]);
  }
  return true;
}

async function listUserWorkouts(filters) {
  const hasEvents = await hasCompletionEventsTable();
  if (!hasEvents) {
    return {
      data: [],
      pagination: paginationMeta(filters.page, filters.limit, 0),
      note: 'exercise_completion_events table not migrated; no per-session history yet',
    };
  }

  const { page, limit, userId, workoutId, status, from, to } = filters;
  const offset = (page - 1) * limit;
  const params = [];
  const clauses = ['1=1'];

  if (userId) {
    clauses.push('e.uid = ?');
    params.push(userId);
  }
  if (workoutId) {
    clauses.push('e.exercise_id = ?');
    params.push(workoutId);
  }
  if (status) {
    clauses.push('e.status = ?');
    params.push(status);
  }
  if (from) {
    clauses.push('DATE(e.completed_at) >= ?');
    params.push(from);
  }
  if (to) {
    clauses.push('DATE(e.completed_at) <= ?');
    params.push(to);
  }

  const where = `WHERE ${clauses.join(' AND ')}`;
  const [countRows] = await db.query(
    `SELECT COUNT(*) AS total FROM exercise_completion_events e ${where}`,
    params
  );
  const total = countRows[0]?.total || 0;

  const rows = await db.query(
    `SELECT e.*, ex.title_en, ex.title_tr
     FROM exercise_completion_events e
     LEFT JOIN exercises ex ON ex.id = e.exercise_id
     ${where}
     ORDER BY e.completed_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return {
    data: rows.map((r) =>
      mapPanelUserWorkout(r, r.title_en || r.title_tr)
    ),
    pagination: paginationMeta(page, limit, Number(total)),
  };
}

async function getUserWorkoutById(id) {
  const hasEvents = await hasCompletionEventsTable();
  if (!hasEvents) return null;

  const rows = await db.query(
    `SELECT e.*, ex.title_en, ex.title_tr
     FROM exercise_completion_events e
     LEFT JOIN exercises ex ON ex.id = e.exercise_id
     WHERE e.id = ?`,
    [id]
  );
  if (!rows.length) return null;
  return mapPanelUserWorkout(rows[0], rows[0].title_en || rows[0].title_tr);
}

async function logExerciseCompletion(uid, exerciseId, durationSeconds) {
  if (!(await hasCompletionEventsTable())) return;

  try {
    await db.query(
      `INSERT INTO exercise_completion_events (uid, exercise_id, status, duration_seconds, completed_at)
       VALUES (?, ?, 'completed', ?, UTC_TIMESTAMP())`,
      [uid, exerciseId, durationSeconds || 0]
    );
  } catch (error) {
    logger.warn('Panel completion event log failed (mobile flow unaffected):', error.message);
  }
}

module.exports = {
  getTimezone,
  getDailyDays,
  getAnalyse,
  listUsers,
  getUserById,
  patchUser,
  listWorkouts,
  getWorkoutById,
  createWorkout,
  patchWorkout,
  deleteWorkout,
  listUserWorkouts,
  getUserWorkoutById,
  logExerciseCompletion,
  hasCompletionEventsTable,
};
