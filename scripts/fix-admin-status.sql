-- =============================================================================
-- FIX ADMIN STATUS - Ensure ritho@ralls is properly set as admin
-- =============================================================================

-- Step 1: Verify current status
SELECT 
    'Current Status' as step,
    email,
    username,
    is_admin,
    subscription_tier,
    bankroll
FROM profiles 
WHERE email = 'ritho@ralls';

-- Step 2: Update to admin (if not already)
UPDATE profiles 
SET 
    is_admin = true,
    subscription_tier = 'admin',
    username = COALESCE(username, 'admin_ritho'),
    display_name = COALESCE(display_name, 'Ritho Admin'),
    updated_at = NOW()
WHERE email = 'ritho@ralls';

-- Step 3: Verify the update
SELECT 
    'After Update' as step,
    email,
    username,
    is_admin,
    subscription_tier,
    bankroll,
    updated_at
FROM profiles 
WHERE email = 'ritho@ralls';

-- Step 4: Check if there are any RLS policies blocking access
SELECT 
    'RLS Policies' as step,
    policyname,
    permissive,
    roles,
    cmd as command_type
FROM pg_policies 
WHERE tablename = 'profiles'
ORDER BY policyname;

-- Expected Result:
-- is_admin should be: true
-- subscription_tier should be: 'admin'
