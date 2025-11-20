-- ============================================
-- COMPLETE USER DELETION SCRIPT
-- ============================================
-- Run this in Supabase SQL Editor
-- Replace 'YOUR-USER-EMAIL' with the email you want to delete
-- ============================================

-- Step 1: Find the user ID
-- Run this first to get the UUID:
SELECT id, email FROM auth.users WHERE email = 'ritho@ralls.com';

-- Step 2: Copy the UUID from above, then run this:
-- Replace 'USER-UUID-HERE' with the actual UUID from Step 1

-- Delete from profiles table first (foreign key constraint)
DELETE FROM profiles WHERE id = 'USER-UUID-HERE';

-- Delete from auth.users (this will also delete all auth-related data)
DELETE FROM auth.users WHERE id = 'USER-UUID-HERE';

-- ============================================
-- ALTERNATIVE: Delete by email (if you prefer)
-- ============================================
-- This does both in one go:
DO $$
DECLARE
  user_uuid UUID;
BEGIN
  -- Get user ID
  SELECT id INTO user_uuid FROM auth.users WHERE email = 'ritho@ralls.com';
  
  IF user_uuid IS NOT NULL THEN
    -- Delete from profiles
    DELETE FROM profiles WHERE id = user_uuid;
    
    -- Delete from auth.users
    DELETE FROM auth.users WHERE id = user_uuid;
    
    RAISE NOTICE 'User deleted successfully';
  ELSE
    RAISE NOTICE 'User not found';
  END IF;
END $$;

-- ============================================
-- VERIFY DELETION
-- ============================================
SELECT id, email FROM auth.users WHERE email = 'ritho@ralls.com';
SELECT id, email FROM profiles WHERE email = 'ritho@ralls.com';
-- Both should return empty

