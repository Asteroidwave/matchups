-- ============================================
-- LIVE CONTEST ENHANCEMENTS (PHASE 1)
-- Adds scheduling metadata and lifecycle tracking to contests
-- ============================================

-- 1. Extend contests table with scheduling columns
ALTER TABLE contests
  ADD COLUMN IF NOT EXISTS first_post_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_post_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lock_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lifecycle_status TEXT DEFAULT 'scheduled';

-- 2. Index new scheduling columns for efficient queries
CREATE INDEX IF NOT EXISTS idx_contests_first_post_time ON contests(first_post_time);
CREATE INDEX IF NOT EXISTS idx_contests_lock_time ON contests(lock_time);
CREATE INDEX IF NOT EXISTS idx_contests_lifecycle_status ON contests(lifecycle_status);

-- 3. (Optional) Backfill lifecycle_status for existing contests
-- UPDATE contests
-- SET lifecycle_status = CASE
--   WHEN is_active = TRUE THEN 'live'
--   WHEN status = 'ready' THEN 'scheduled'
--   ELSE 'draft'
-- END
-- WHERE lifecycle_status IS NULL;


