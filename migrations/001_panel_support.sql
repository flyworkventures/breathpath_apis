-- App Panel support for BreathPath
-- Run once on production DB. Safe to re-run partial statements manually if needed.

-- Soft publish state for exercises (mobile app ignores this column)
ALTER TABLE exercises
  ADD COLUMN panel_status VARCHAR(20) NOT NULL DEFAULT 'published'
  COMMENT 'draft | published | archived — panel only';

-- Per-completion log for panel user-workouts + analyse (mobile keeps aggregate stats on users)
CREATE TABLE IF NOT EXISTS exercise_completion_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  uid VARCHAR(128) NOT NULL,
  exercise_id INT UNSIGNED NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'completed',
  duration_seconds INT UNSIGNED NOT NULL DEFAULT 0,
  completed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  extras JSON NULL,
  INDEX idx_uid_completed (uid, completed_at),
  INDEX idx_exercise_id (exercise_id),
  INDEX idx_completed_at (completed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
