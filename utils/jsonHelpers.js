/**
 * Safe JSON helpers — mysql2 may return JSON columns already parsed as objects.
 */

function parseJson(value, fallback = []) {
  if (value == null || value === '') return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function hasPremiumDatas(premiumDatas) {
  const arr = parseJson(premiumDatas, []);
  return Array.isArray(arr) && arr.length > 0;
}

module.exports = {
  parseJson,
  hasPremiumDatas,
};
