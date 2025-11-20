-- Migration: Add precalculated_outcome column to entries table
-- Purpose: Store pre-calculated round outcomes for instant results
-- Date: 2025-11-18

-- Add the precalculated_outcome column
ALTER TABLE entries 
ADD COLUMN IF NOT EXISTS precalculated_outcome JSONB;

-- Add index for faster queries on entries with pre-calculated outcomes
CREATE INDEX IF NOT EXISTS idx_entries_precalculated 
ON entries(contest_id, status) 
WHERE precalculated_outcome IS NOT NULL;

-- Add composite index for user's pending entries
CREATE INDEX IF NOT EXISTS idx_entries_user_pending 
ON entries(user_id, contest_id) 
WHERE status = 'pending';

-- Add comment explaining the column
COMMENT ON COLUMN entries.precalculated_outcome IS 
'Pre-calculated round outcome including matchup results, points, and final winnings. Calculated on submission using real results data from track_data. Structure: { matchups: [...], correctPicks: N, totalPicks: N, actualMultiplier: X, finalWinnings: X, outcome: "won"|"lost", calculatedAt: ISO8601 }';

-- Verify the column was added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'entries' AND column_name = 'precalculated_outcome';

