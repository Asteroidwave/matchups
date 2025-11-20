-- =============================================================================
-- SAFE SUPABASE CLEANUP - Only deletes from NEW relational schema tables
-- =============================================================================
-- This script ONLY affects tables that exist in the NEW relational schema
-- Safe to run multiple times - only deletes data, preserves table structure
-- =============================================================================

-- Step 1: Clear all existing data (keep tables, remove data)
-- Delete in order to respect foreign key constraints

-- User data first (has foreign keys to other tables)
DELETE FROM user_picks;
DELETE FROM user_entries;

-- Contest and matchup data
DELETE FROM matchup_entries;
DELETE FROM matchups;
DELETE FROM matchup_pools;
DELETE FROM contest_races;
DELETE FROM contests;

-- Race results and entries
DELETE FROM race_results;  -- Note: This is race_results, NOT contest_results
DELETE FROM race_entries;
DELETE FROM races;
DELETE FROM race_cards;

-- Core entities
DELETE FROM horses;
DELETE FROM connections;
DELETE FROM tracks;

-- System tables (optional - only if you want to clear logs)
-- Uncomment these if you want to clear system logs too:
-- DELETE FROM data_ingestion_logs;
-- DELETE FROM entry_changes;
-- DELETE FROM system_events;
-- DELETE FROM rounds;  -- Only if you have this table

-- Step 2: Clear all user profiles (we'll recreate ritho@ralls)
DELETE FROM profiles;

-- Step 3: Verify tables are empty (only NEW schema tables)
SELECT 'tracks' as table_name, COUNT(*) as row_count FROM tracks
UNION ALL
SELECT 'horses', COUNT(*) FROM horses  
UNION ALL
SELECT 'connections', COUNT(*) FROM connections
UNION ALL
SELECT 'contests', COUNT(*) FROM contests
UNION ALL
SELECT 'race_cards', COUNT(*) FROM race_cards
UNION ALL
SELECT 'races', COUNT(*) FROM races
UNION ALL
SELECT 'race_entries', COUNT(*) FROM race_entries
UNION ALL
SELECT 'race_results', COUNT(*) FROM race_results
UNION ALL
SELECT 'matchups', COUNT(*) FROM matchups
UNION ALL
SELECT 'user_entries', COUNT(*) FROM user_entries
UNION ALL
SELECT 'user_picks', COUNT(*) FROM user_picks
UNION ALL
SELECT 'profiles', COUNT(*) FROM profiles;
