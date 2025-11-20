-- SUPABASE CLEANUP SCRIPT
-- This removes all old tables and keeps only the new relational schema
-- Run this in Supabase SQL Editor

-- =============================================================================
-- STEP 1: DROP OLD/UNUSED TABLES (if they exist)
-- =============================================================================

-- Drop old contest-related tables that might conflict
DROP TABLE IF EXISTS old_contests CASCADE;
DROP TABLE IF EXISTS legacy_contests CASCADE;
DROP TABLE IF EXISTS contests_backup CASCADE;

-- Drop any other old tables you might have created during development
DROP TABLE IF EXISTS test_table CASCADE;
DROP TABLE IF EXISTS temp_data CASCADE;
DROP TABLE IF EXISTS migration_backup CASCADE;

-- =============================================================================
-- STEP 2: CLEAN UP EXISTING DATA (keep schema, remove data)
-- =============================================================================

-- Clear all existing data but keep the relational schema structure
DELETE FROM user_picks;
DELETE FROM user_entries;
DELETE FROM contest_results;
DELETE FROM race_entries;
DELETE FROM races;
DELETE FROM race_cards;
DELETE FROM contests;
DELETE FROM horses;
DELETE FROM connections;
DELETE FROM tracks;

-- Clear user data except what we'll recreate
DELETE FROM profiles WHERE email != 'ritho@ralls';

-- Clear auth users (this will cascade to profiles due to foreign key)
-- Note: You might need to do this in Supabase Auth dashboard instead
-- DELETE FROM auth.users WHERE email != 'ritho@ralls';

-- =============================================================================
-- STEP 3: RESET SEQUENCES (so IDs start from 1 again)
-- =============================================================================

-- Reset any sequences if using SERIAL columns
-- Most of our tables use UUIDs, but reset any that don't
-- ALTER SEQUENCE IF EXISTS some_sequence_name RESTART WITH 1;

-- =============================================================================
-- STEP 4: VERIFY CLEAN STATE
-- =============================================================================

-- Check that tables exist but are empty
SELECT 'tracks' as table_name, COUNT(*) as row_count FROM tracks
UNION ALL
SELECT 'horses', COUNT(*) FROM horses  
UNION ALL
SELECT 'connections', COUNT(*) FROM connections
UNION ALL
SELECT 'contests', COUNT(*) FROM contests
UNION ALL
SELECT 'profiles', COUNT(*) FROM profiles;

-- =============================================================================
-- STEP 5: CREATE ADMIN USER PROFILE
-- =============================================================================

-- First, the user needs to be created in Supabase Auth
-- This SQL assumes the auth.users record already exists
-- If not, create the user through Supabase Auth dashboard first

-- Insert admin profile (will fail if auth user doesn't exist)
INSERT INTO profiles (
    id,
    email,
    is_admin,
    bankroll,
    username,
    display_name,
    favorite_tracks,
    subscription_tier,
    created_at,
    updated_at
) VALUES (
    (SELECT id FROM auth.users WHERE email = 'ritho@ralls' LIMIT 1),
    'ritho@ralls',
    true,  -- ADMIN USER
    10000,  -- High bankroll for admin
    'admin_ritho',
    'Ritho Admin',
    ARRAY['CD', 'GP', 'AQU'],
    'admin',
    NOW(),
    NOW()
) ON CONFLICT (id) DO UPDATE SET
    is_admin = true,
    username = 'admin_ritho',
    display_name = 'Ritho Admin',
    subscription_tier = 'admin',
    updated_at = NOW();

-- Verify admin user was created
SELECT 
    id,
    email,
    username,
    display_name,
    is_admin,
    bankroll,
    subscription_tier
FROM profiles 
WHERE email = 'ritho@ralls';

-- =============================================================================
-- COMPLETION MESSAGE
-- =============================================================================

SELECT 'Supabase cleanup completed successfully!' as status,
       'ritho@ralls should now be an admin user' as next_step,
       'All old data cleared, schema preserved' as result;
