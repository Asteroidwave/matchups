-- =============================================================================
-- CHECK CONTESTS TABLE SCHEMA - Identify if it's old or new schema
-- =============================================================================

-- Check which columns exist in contests table
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'contests'
ORDER BY ordinal_position;

-- Check if it's old schema (has is_active) or new schema (has is_public)
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'contests' 
            AND column_name = 'is_public'
        ) THEN '✅ NEW SCHEMA (has is_public)'
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'contests' 
            AND column_name = 'is_active'
        ) THEN '⚠️ OLD SCHEMA (has is_active)'
        ELSE '❓ UNKNOWN SCHEMA'
    END as schema_version;

-- Check if user_preferences exists and what it contains
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'user_preferences'
        ) THEN '✅ EXISTS'
        ELSE '❌ DOES NOT EXIST'
    END as user_preferences_status;

-- If user_preferences exists, show its structure
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'user_preferences'
ORDER BY ordinal_position;
