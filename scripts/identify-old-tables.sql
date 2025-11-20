-- =============================================================================
-- IDENTIFY OLD/UNUSED TABLES vs NEW RELATIONAL SCHEMA TABLES
-- =============================================================================

-- Step 1: List ALL tables in public schema
SELECT 
    'All Tables' as category,
    table_name,
    CASE 
        WHEN table_name LIKE '%_backup_%' THEN '❌ BACKUP (DELETE)'
        WHEN table_name IN (
            'tracks', 'horses', 'connections', 'race_cards', 'races', 
            'race_entries', 'race_results', 'contests', 'contest_races',
            'matchup_pools', 'matchups', 'matchup_entries', 'user_entries',
            'user_picks', 'rounds', 'data_ingestion_logs', 'entry_changes',
            'system_events', 'profiles', 'user_preferences'
        ) THEN '✅ NEW SCHEMA (or enhancement)'
        ELSE '⚠️ CHECK IF OLD'
    END as status
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY 
    CASE 
        WHEN table_name LIKE '%_backup_%' THEN 1
        WHEN table_name IN (
            'tracks', 'horses', 'connections', 'race_cards', 'races', 
            'race_entries', 'race_results', 'contests', 'contest_races',
            'matchup_pools', 'matchups', 'matchup_entries', 'user_entries',
            'user_picks', 'rounds', 'data_ingestion_logs', 'entry_changes',
            'system_events', 'profiles'
        ) THEN 2
        ELSE 3
    END,
    table_name;

-- Step 2: Check RLS status for all tables
SELECT 
    schemaname,
    tablename,
    CASE 
        WHEN tablename IN (
            'tracks', 'horses', 'connections', 'race_cards', 'races', 
            'race_entries', 'race_results', 'contests', 'contest_races',
            'matchup_pools', 'matchups', 'matchup_entries', 'user_entries',
            'user_picks', 'rounds', 'data_ingestion_logs', 'entry_changes',
            'system_events', 'profiles'
        ) THEN '✅ NEW SCHEMA'
        WHEN tablename LIKE '%_backup_%' THEN '❌ BACKUP'
        ELSE '⚠️ CHECK'
    END as table_type,
    CASE 
        WHEN (SELECT relrowsecurity FROM pg_class WHERE relname = tablename) THEN '✅ ENABLED'
        ELSE '❌ DISABLED (UNRESTRICTED)'
    END as rls_status
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY 
    CASE 
        WHEN tablename LIKE '%_backup_%' THEN 1
        WHEN tablename IN (
            'tracks', 'horses', 'connections', 'race_cards', 'races', 
            'race_entries', 'race_results', 'contests', 'contest_races',
            'matchup_pools', 'matchups', 'matchup_entries', 'user_entries',
            'user_picks', 'rounds', 'data_ingestion_logs', 'entry_changes',
            'system_events', 'profiles'
        ) THEN 2
        ELSE 3
    END,
    tablename;
