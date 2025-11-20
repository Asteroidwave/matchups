-- Fix Matchup ID Mismatch Issue
-- This script helps identify and fix entries with mismatched matchup IDs

-- Step 1: Find entries with picks that reference non-existent matchups
-- This query will show you which entries have problems

WITH all_matchups AS (
  -- Extract all matchup IDs from the matchups table
  SELECT 
    m.contest_id,
    jsonb_array_elements(m.matchup_data->'matchups')->>'id' as matchup_id
  FROM matchups m
),
entry_picks AS (
  -- Extract all matchup IDs from entries' picks
  SELECT 
    e.id as entry_id,
    e.contest_id,
    e.user_id,
    e.entry_amount,
    e.status,
    e.created_at,
    jsonb_array_elements(e.picks)->>'matchupId' as pick_matchup_id
  FROM entries e
  WHERE e.status = 'pending'
)
SELECT 
  ep.entry_id,
  ep.contest_id,
  ep.user_id,
  ep.entry_amount,
  ep.created_at,
  ep.pick_matchup_id,
  CASE 
    WHEN am.matchup_id IS NULL THEN '❌ NOT FOUND'
    ELSE '✅ FOUND'
  END as matchup_status
FROM entry_picks ep
LEFT JOIN all_matchups am 
  ON ep.contest_id = am.contest_id 
  AND ep.pick_matchup_id = am.matchup_id
WHERE am.matchup_id IS NULL  -- Only show problematic entries
ORDER BY ep.entry_id, ep.pick_matchup_id;

-- Step 2: Delete the problematic entry (UNCOMMENT TO RUN)
-- DELETE FROM entries WHERE id = '55365266-b773-4bf1-82c8-e23dc716995c';

-- Step 3: Verify deletion (UNCOMMENT TO RUN)
-- SELECT * FROM entries WHERE id = '55365266-b773-4bf1-82c8-e23dc716995c';

-- Step 4: Check all pending entries for this user
-- SELECT 
--   id,
--   contest_id,
--   entry_amount,
--   status,
--   created_at,
--   jsonb_array_length(picks) as pick_count
-- FROM entries
-- WHERE user_id = 'a435af6d-6dcb-41a6-91ec-656fa007fb0c'
--   AND status = 'pending'
-- ORDER BY created_at DESC;

-- Step 5: Check available matchups for LRL contest
-- SELECT 
--   m.id as matchup_row_id,
--   m.contest_id,
--   m.matchup_type,
--   jsonb_array_length(m.matchup_data->'matchups') as matchup_count,
--   (m.matchup_data->'matchups'->0)->>'id' as first_matchup_id
-- FROM matchups m
-- WHERE m.contest_id = 'af5195bb-d488-4bba-8601-2eebace2fb2e'  -- LRL contest
-- ORDER BY m.matchup_type;

