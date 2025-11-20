-- =============================================================================
-- CLEANUP OLD/UNUSED TABLES - Remove tables not in NEW relational schema
-- =============================================================================
-- WARNING: This will DELETE tables. Review carefully before running!
-- =============================================================================

-- Step 1: List tables that should be DELETED (backups and old tables)
SELECT 
    'Tables to DELETE' as action,
    table_name,
    'Backup table - safe to delete' as reason
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
  AND (
    table_name LIKE '%_backup_%'
    OR table_name IN (
      -- OLD tables that are NOT in new schema
      'entries',           -- OLD: replaced by user_entries
      'track_data',        -- OLD: replaced by tracks + race_cards
      'operations',        -- OLD: not in new schema
      'simulation_events', -- OLD: not in new schema
      'simulations'        -- OLD: not in new schema
      -- Note: user_preferences might be used - verify before deleting
    )
  )
ORDER BY table_name;

-- Step 2: DROP backup tables (safe to delete)
-- Uncomment to execute:
/*
DROP TABLE IF EXISTS contests_backup_20251120_0431 CASCADE;
DROP TABLE IF EXISTS contests_backup_20251120_0535 CASCADE;
DROP TABLE IF EXISTS entries_backup_20251120_0431 CASCADE;
DROP TABLE IF EXISTS entries_backup_20251120_0535 CASCADE;
DROP TABLE IF EXISTS profiles_backup_20251120_0431 CASCADE;
DROP TABLE IF EXISTS profiles_backup_20251120_0535 CASCADE;
-- Add any other backup tables found
*/

-- Step 3: DROP old tables (if they exist and are not used)
-- WARNING: Only run if you're sure these tables are not needed!
-- Uncomment to execute:
/*
DROP TABLE IF EXISTS entries CASCADE;           -- Replaced by user_entries
DROP TABLE IF EXISTS track_data CASCADE;        -- Replaced by tracks + race_cards
DROP TABLE IF EXISTS operations CASCADE;        -- Not in new schema
DROP TABLE IF EXISTS simulation_events CASCADE; -- Not in new schema
DROP TABLE IF EXISTS simulations CASCADE;        -- Not in new schema
DROP TABLE IF EXISTS user_preferences CASCADE;  -- Not in new schema
*/

-- Step 4: Verify only NEW schema tables remain
SELECT 
    'Remaining Tables' as status,
    table_name,
    CASE 
        WHEN table_name IN (
            'tracks', 'horses', 'connections', 'race_cards', 'races', 
            'race_entries', 'race_results', 'contests', 'contest_races',
            'matchup_pools', 'matchups', 'matchup_entries', 'user_entries',
            'user_picks', 'rounds', 'data_ingestion_logs', 'entry_changes',
            'system_events', 'profiles'
        ) THEN '✅ NEW SCHEMA'
        ELSE '⚠️ UNKNOWN - Review manually'
    END as table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY 
    CASE 
        WHEN table_name IN (
            'tracks', 'horses', 'connections', 'race_cards', 'races', 
            'race_entries', 'race_results', 'contests', 'contest_races',
            'matchup_pools', 'matchups', 'matchup_entries', 'user_entries',
            'user_picks', 'rounds', 'data_ingestion_logs', 'entry_changes',
            'system_events', 'profiles'
        ) THEN 1
        ELSE 2
    END,
    table_name;
