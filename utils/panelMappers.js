/**
 * Maps BreathPath DB rows → App Panel canonical JSON (contract v2).
 */

const CONTRACT_VERSION = '2';

function toIso(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function parseJson(value, fallback) {
  if (value == null || value === '') return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function hasPremium(premiumDatas) {
  const arr = parseJson(premiumDatas, []);
  return Array.isArray(arr) && arr.length > 0;
}

function localizedTitlesFromExercise(row) {
  return {
    tr: row.title_tr ?? null,
    en: row.title_en ?? null,
    de: row.title_de ?? null,
    ar: row.title_ar ?? null,
    fr: row.title_fr ?? null,
    ko: row.title_ko ?? null,
    ja: row.title_ja ?? null,
    es: row.title_es ?? null,
    it: row.title_it ?? null,
    hi: row.title_hi ?? null,
    pt: row.title_pt ?? null,
    ru: row.title_ru ?? null,
    zh: row.title_zh ?? null,
    ch: row.title_zh ?? null,
  };
}

function workoutStatus(row) {
  if (row.panel_status) return row.panel_status;
  return 'published';
}

/**
 * duration in DB is stored in seconds (mobile API).
 */
function secondsToMinutes(seconds) {
  if (seconds == null || Number.isNaN(Number(seconds))) return null;
  return Math.round(Number(seconds) / 60);
}

function minutesToSeconds(minutes) {
  if (minutes == null || Number.isNaN(Number(minutes))) return null;
  return Math.round(Number(minutes) * 60);
}

function mapPanelUser(row) {
  const favorites = parseJson(row.favorites_exercises, []);
  const premiumDatas = parseJson(row.premium_datas, []);

  return {
    id: String(row.uid),
    email: row.email ?? null,
    displayName: row.username ?? null,
    phone: null,
    status: row.is_active ? 'active' : 'inactive',
    createdAt: toIso(row.account_created_date),
    lastLoginAt: toIso(row.last_active),
    extras: {
      authProvider: row.auth_provider ?? null,
      profilePhotoUrl: row.profile_photo_url ?? null,
      isPremium: hasPremium(row.premium_datas),
      premiumDatas,
      favoritesExercises: favorites,
      totalExerciseTimeSeconds: row.total_exercise_time ?? 0,
      completedExercisesCount: row.completed_exercises_count ?? 0,
      currentStreak: row.current_streak ?? 0,
      lastExerciseDate: row.last_exercise_date
        ? toIso(row.last_exercise_date)?.split('T')[0]
        : null,
      internalUserId: row.id ?? null,
    },
  };
}

function mapPanelWorkout(row) {
  const title =
    row.title_en ||
    row.title_tr ||
    `Exercise #${row.id}`;

  return {
    id: String(row.id),
    title,
    description: row.explain_en || row.explain_tr || null,
    status: workoutStatus(row),
    difficulty: row.level ?? null,
    durationMinutes: secondsToMinutes(row.duration),
    category: row.category ?? null,
    coverImageUrl: row.video_image_url ?? null,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    publishedAt: workoutStatus(row) === 'published' ? toIso(row.created_at) : null,
    extras: {
      tabCategory: row.tab_category ?? null,
      subCategory: row.sub_category ?? null,
      videoUrl: row.video_url ?? null,
      isPremium: Boolean(row.is_premium),
      steps: parseJson(row.steps, []),
      localizedTitles: localizedTitlesFromExercise(row),
      localizedBenefits: {
        tr: parseJson(row.benefits_tr, []),
        en: parseJson(row.benefits_en, []),
        ru: parseJson(row.benefits_ru, []),
        zh: parseJson(row.benefits_zh, []),
      },
      localizedExplain: {
        tr: row.explain_tr ?? null,
        en: row.explain_en ?? null,
        ru: row.explain_ru ?? null,
        zh: row.explain_zh ?? null,
      },
    },
  };
}

function mapPanelUserWorkout(row, exerciseTitle) {
  return {
    id: String(row.id),
    userId: String(row.uid),
    workoutId: String(row.exercise_id),
    workoutTitle: exerciseTitle ?? row.workout_title ?? null,
    status: row.status || 'completed',
    startedAt: toIso(row.completed_at),
    completedAt: toIso(row.completed_at),
    durationMinutes: secondsToMinutes(row.duration_seconds),
    caloriesBurned: null,
    progressPercent: 100,
    extras: parseJson(row.extras, {}),
  };
}

function paginationMeta(page, limit, total) {
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
  return { page, limit, total, totalPages };
}

module.exports = {
  CONTRACT_VERSION,
  mapPanelUser,
  mapPanelWorkout,
  mapPanelUserWorkout,
  paginationMeta,
  parseJson,
  localizedTitlesFromExercise,
  secondsToMinutes,
  minutesToSeconds,
  toIso,
};
