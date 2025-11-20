-- =============================================================================
-- VERIFY ADMIN STATUS - Check if ritho@ralls is properly set as admin
-- =============================================================================

-- Step 1: Check if user exists in auth.users
SELECT 
    id,
    email,
    email_confirmed_at,
    created_at
FROM auth.users 
WHERE email = 'ritho@ralls';

-- Step 2: Check profile in profiles table
SELECT 
    id,
    email,
    username,
    display_name,
    is_admin,  -- This should be TRUE
    bankroll,
    subscription_tier,
    created_at,
    updated_at
FROM profiles 
WHERE email = 'ritho@ralls';

-- Step 3: Verify the relationship (profile.id should match auth.users.id)
SELECT 
    u.id as auth_user_id,
    u.email as auth_email,
    p.id as profile_id,
    p.email as profile_email,
    p.is_admin,
    CASE 
        WHEN u.id = p.id THEN '✅ IDs Match'
        ELSE '❌ IDs DO NOT MATCH'
    END as id_match_status
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
WHERE u.email = 'ritho@ralls';

-- Step 4: Check RLS policies that might block admin access
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'profiles'
ORDER BY policyname;
