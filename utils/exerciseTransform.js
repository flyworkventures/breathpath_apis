/**
 * Shared exercise row → mobile API JSON transform.
 */

function parseJsonField(value, fallback = []) {
  if (value == null || value === '') return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function transformExercise(exercise, userIsPremium = true) {
  const isPremiumExercise = exercise.is_premium === 1 || exercise.is_premium === true;
  const restrictContent = isPremiumExercise && !userIsPremium;

  return {
    id: exercise.id,
    category: exercise.category,
    tabCategory: exercise.tab_category,
    level: exercise.level,
    videoImageURL: exercise.video_image_url,
    videoUrl: restrictContent ? null : exercise.video_url,
    subCategory: exercise.sub_category,
    title: {
      tr: exercise.title_tr,
      en: exercise.title_en,
      de: exercise.title_de,
      ar: exercise.title_ar,
      fr: exercise.title_fr,
      ko: exercise.title_ko,
      ja: exercise.title_ja,
      es: exercise.title_es,
      it: exercise.title_it,
      hi: exercise.title_hi,
      pt: exercise.title_pt,
      ru: exercise.title_ru ?? null,
      ch: exercise.title_zh ?? null,
      zh: exercise.title_zh ?? null,
    },
    duration: exercise.duration,
    benefits: {
      tr: parseJsonField(exercise.benefits_tr, []),
      en: parseJsonField(exercise.benefits_en, []),
      de: parseJsonField(exercise.benefits_de, []),
      ar: parseJsonField(exercise.benefits_ar, []),
      fr: parseJsonField(exercise.benefits_fr, []),
      ko: parseJsonField(exercise.benefits_ko, []),
      ja: parseJsonField(exercise.benefits_ja, []),
      es: parseJsonField(exercise.benefits_es, []),
      it: parseJsonField(exercise.benefits_it, []),
      hi: parseJsonField(exercise.benefits_hi, []),
      pt: parseJsonField(exercise.benefits_pt, []),
      ru: parseJsonField(exercise.benefits_ru, []),
      ch: parseJsonField(exercise.benefits_zh, []),
      zh: parseJsonField(exercise.benefits_zh, []),
    },
    explain: {
      tr: exercise.explain_tr,
      en: exercise.explain_en,
      de: exercise.explain_de,
      ar: exercise.explain_ar,
      fr: exercise.explain_fr,
      ko: exercise.explain_ko,
      ja: exercise.explain_ja,
      es: exercise.explain_es,
      it: exercise.explain_it,
      hi: exercise.explain_hi,
      pt: exercise.explain_pt,
      ru: exercise.explain_ru ?? null,
      ch: exercise.explain_zh ?? null,
      zh: exercise.explain_zh ?? null,
    },
    steps: restrictContent ? [] : parseJsonField(exercise.steps, []),
    isPremium: isPremiumExercise,
    createdAt: exercise.created_at,
    updatedAt: exercise.updated_at,
  };
}

module.exports = {
  transformExercise,
  parseJsonField,
};
