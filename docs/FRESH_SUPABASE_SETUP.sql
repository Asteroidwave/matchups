-- ============================================
-- FRESH SUPABASE SETUP - COMPLETE SQL SCRIPT
-- ============================================
-- Run this ENTIRE script in Supabase SQL Editor
-- This will create everything from scratch
-- ============================================

-- ============================================
-- STEP 1: DROP EXISTING TABLES (if they exist)
-- ============================================
DROP TABLE IF EXISTS contests CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP FUNCTION IF EXISTS is_user_admin(UUID) CASCADE;

-- ============================================
-- STEP 2: CREATE PROFILES TABLE
-- ============================================
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT,
  is_admin BOOLEAN DEFAULT FALSE,
  bankroll DECIMAL(10, 2) DEFAULT 1000.00,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 3: CREATE ADMIN CHECK FUNCTION
-- ============================================
-- This function bypasses RLS to check admin status
CREATE OR REPLACE FUNCTION is_user_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = user_id AND is_admin = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- STEP 4: CREATE RLS POLICIES FOR PROFILES
-- ============================================

-- Policy: Users can view their own profile
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- Policy: Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Policy: Users can insert their own profile
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Policy: Admins can view all profiles
CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  USING (
    auth.uid() = id OR
    is_user_admin(auth.uid())
  );

-- Policy: Admins can update all profiles
CREATE POLICY "Admins can update all profiles"
  ON profiles FOR UPDATE
  USING (
    auth.uid() = id OR
    is_user_admin(auth.uid())
  )
  WITH CHECK (
    auth.uid() = id OR
    is_user_admin(auth.uid())
  );

-- ============================================
-- STEP 5: CREATE CONTESTS TABLE
-- ============================================
CREATE TABLE contests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  track TEXT NOT NULL,
  date DATE NOT NULL,
  contest_type TEXT NOT NULL DEFAULT 'jockey_vs_jockey',
  entry_fee DECIMAL(10, 2),
  prize_pool DECIMAL(10, 2),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(track, date, contest_type)
);

-- Enable Row Level Security
ALTER TABLE contests ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 6: CREATE RLS POLICIES FOR CONTESTS
-- ============================================

-- Policy: Everyone can view active contests
CREATE POLICY "Anyone can view active contests"
  ON contests FOR SELECT
  USING (is_active = TRUE);

-- Policy: Only admins can create contests
CREATE POLICY "Admins can create contests"
  ON contests FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND is_admin = TRUE
    )
  );

-- Policy: Only admins can update contests
CREATE POLICY "Admins can update contests"
  ON contests FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND is_admin = TRUE
    )
  );

-- Policy: Only admins can delete contests
CREATE POLICY "Admins can delete contests"
  ON contests FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND is_admin = TRUE
    )
  );

-- Policy: Admins can view all contests (including inactive)
CREATE POLICY "Admins can view all contests"
  ON contests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND is_admin = TRUE
    )
  );

-- ============================================
-- STEP 7: CREATE TRIGGER TO AUTO-CREATE PROFILE
-- ============================================
-- When a user signs up, automatically create their profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, is_admin, bankroll)
  VALUES (
    NEW.id,
    NEW.email,
    FALSE, -- Default to not admin
    1000.00 -- Default bankroll
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- STEP 8: CREATE TRIGGER TO UPDATE updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for profiles
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for contests
DROP TRIGGER IF EXISTS update_contests_updated_at ON contests;
CREATE TRIGGER update_contests_updated_at
  BEFORE UPDATE ON contests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- STEP 9: MANUALLY CREATE YOUR ADMIN PROFILE
-- ============================================
-- Replace 'your-user-id-here' with your actual user ID from auth.users
-- You can find it in Supabase Dashboard → Authentication → Users
-- Or run: SELECT id, email FROM auth.users;

-- Example (UPDATE WITH YOUR ACTUAL USER ID):
-- INSERT INTO profiles (id, email, is_admin, bankroll)
-- VALUES (
--   'your-user-id-from-auth-users-table',
--   'ritho@ralls.com',
--   TRUE,
--   1000.00
-- )
-- ON CONFLICT (id) DO UPDATE SET
--   is_admin = TRUE,
--   email = 'ritho@ralls.com';

-- ============================================
-- VERIFICATION QUERIES (Run these to check)
-- ============================================

-- Check if tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('profiles', 'contests');

-- Check if policies exist
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE tablename IN ('profiles', 'contests');

-- Check if function exists
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name = 'is_user_admin';

-- ============================================
-- COMPLETE! ✅
-- ============================================

