-- =============================================================================
-- FIX EMAIL MISMATCH AND ADMIN STATUS
-- =============================================================================
-- Problem: Logged in as ritho@ralls.com but Supabase has ritho@ralls
-- Solution: Update both auth.users and profiles to match
-- =============================================================================

-- Step 1: Check current state
SELECT 
    'Current State' as step,
    u.id,
    u.email as auth_email,
    p.email as profile_email,
    p.is_admin,
    CASE 
        WHEN u.email = p.email THEN '✅ Match'
        ELSE '❌ Mismatch'
    END as email_status
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
WHERE u.email LIKE '%ritho%ralls%' OR p.email LIKE '%ritho%ralls%';

-- Step 2: Update profiles table to match login email (ritho@ralls.com)
UPDATE profiles 
SET 
    email = 'ritho@ralls.com',
    is_admin = true,
    subscription_tier = 'admin',
    username = COALESCE(username, 'admin_ritho'),
    display_name = COALESCE(display_name, 'Ritho Admin'),
    updated_at = NOW()
WHERE email = 'ritho@ralls' OR email = 'ritho@ralls.com';

-- Step 3: Update auth.users if needed (may require admin privileges)
-- Note: You might need to do this in Supabase Auth dashboard instead
-- UPDATE auth.users 
-- SET email = 'ritho@ralls.com'
-- WHERE email = 'ritho@ralls';

-- Step 4: Verify the fix
SELECT 
    'After Fix' as step,
    u.id,
    u.email as auth_email,
    p.email as profile_email,
    p.is_admin,
    p.subscription_tier,
    p.username,
    CASE 
        WHEN u.email = p.email THEN '✅ Match'
        ELSE '❌ Still Mismatch'
    END as email_status
FROM auth.users u
JOIN profiles p ON u.id = p.id
WHERE u.email LIKE '%ritho%ralls%' OR p.email LIKE '%ritho%ralls%';

-- Expected Result:
-- email_status: ✅ Match
-- is_admin: true
-- subscription_tier: admin
