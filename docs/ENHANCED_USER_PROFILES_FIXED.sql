-- Enhanced User Profiles for Multi-User Platform (FIXED VERSION)
-- Run this in Supabase SQL Editor to add rich user profile capabilities

-- ============================================
-- ENHANCE PROFILES TABLE
-- ============================================

-- Add username capability (optional, can be null)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'username'
    ) THEN
        ALTER TABLE profiles ADD COLUMN username VARCHAR(50) UNIQUE;
    END IF;
END $$;

-- Add display name (what others see)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'display_name'
    ) THEN
        ALTER TABLE profiles ADD COLUMN display_name VARCHAR(100);
    END IF;
END $$;

-- Add avatar support
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'avatar_url'
    ) THEN
        ALTER TABLE profiles ADD COLUMN avatar_url TEXT;
    END IF;
END $$;

-- Add user preferences
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'favorite_tracks'
    ) THEN
        ALTER TABLE profiles ADD COLUMN favorite_tracks TEXT[];
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'timezone'
    ) THEN
        ALTER TABLE profiles ADD COLUMN timezone VARCHAR(50) DEFAULT 'America/New_York';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'email_notifications'
    ) THEN
        ALTER TABLE profiles ADD COLUMN email_notifications BOOLEAN DEFAULT TRUE;
    END IF;
END $$;

-- Add performance statistics (calculated from user data)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'total_winnings'
    ) THEN
        ALTER TABLE profiles ADD COLUMN total_winnings DECIMAL(12,2) DEFAULT 0;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'total_entries'
    ) THEN
        ALTER TABLE profiles ADD COLUMN total_entries INTEGER DEFAULT 0;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'win_percentage'
    ) THEN
        ALTER TABLE profiles ADD COLUMN win_percentage DECIMAL(5,2) DEFAULT 0;
    END IF;
END $$;

-- Add activity tracking
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'last_login'
    ) THEN
        ALTER TABLE profiles ADD COLUMN last_login TIMESTAMPTZ;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'login_count'
    ) THEN
        ALTER TABLE profiles ADD COLUMN login_count INTEGER DEFAULT 0;
    END IF;
END $$;

-- Add subscription support (for future premium features)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'subscription_tier'
    ) THEN
        ALTER TABLE profiles ADD COLUMN subscription_tier VARCHAR(20) DEFAULT 'free';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'subscription_expires_at'
    ) THEN
        ALTER TABLE profiles ADD COLUMN subscription_expires_at TIMESTAMPTZ;
    END IF;
END $$;

-- ============================================
-- CREATE INDEXES FOR PERFORMANCE
-- ============================================

-- Username lookup (for login and social features)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_profiles_username') THEN
        CREATE INDEX idx_profiles_username ON profiles(username) WHERE username IS NOT NULL;
    END IF;
END $$;

-- Performance statistics (for leaderboards)  
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_profiles_total_winnings') THEN
        CREATE INDEX idx_profiles_total_winnings ON profiles(total_winnings DESC);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_profiles_win_percentage') THEN
        CREATE INDEX idx_profiles_win_percentage ON profiles(win_percentage DESC);
    END IF;
END $$;

-- Activity tracking (for user analytics)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_profiles_last_login') THEN
        CREATE INDEX idx_profiles_last_login ON profiles(last_login DESC);
    END IF;
END $$;

-- ============================================
-- UPDATE RLS POLICIES FOR NEW FIELDS
-- ============================================

-- Drop and recreate user update policy to include new fields
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
    
    CREATE POLICY "Users can update own profile"
      ON profiles FOR UPDATE
      USING (auth.uid() = id)
      WITH CHECK (auth.uid() = id);
END $$;

-- ============================================
-- USER STATISTICS FUNCTIONS (FIXED)
-- ============================================

-- Function to calculate and update user statistics
CREATE OR REPLACE FUNCTION update_user_statistics(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
  user_stats RECORD;
BEGIN
  -- Calculate user statistics from their rounds
  SELECT 
    COUNT(*) as total_entries,
    COUNT(*) FILTER (WHERE status = 'won') as won_entries,
    COALESCE(SUM(actual_payout), 0) as total_winnings,
    CASE 
      WHEN COUNT(*) > 0 THEN (COUNT(*) FILTER (WHERE status = 'won') * 100.0 / COUNT(*))
      ELSE 0 
    END as win_percentage
  INTO user_stats
  FROM rounds r
  JOIN user_entries ue ON r.user_entry_id = ue.id
  WHERE ue.user_id = p_user_id;
  
  -- Update user profile
  UPDATE profiles 
  SET 
    total_entries = user_stats.total_entries,
    total_winnings = user_stats.total_winnings,
    win_percentage = user_stats.win_percentage,
    updated_at = NOW()
  WHERE id = p_user_id;
  
  -- Fixed RAISE statement with correct parameter count
  RAISE NOTICE 'Updated stats: % entries, $ % winnings, % percent win rate', 
    user_stats.total_entries, user_stats.total_winnings, user_stats.win_percentage;
END;
$$ LANGUAGE plpgsql;

-- Function to get user leaderboard position
CREATE OR REPLACE FUNCTION get_user_leaderboard_position(p_user_id UUID)
RETURNS TABLE (
  total_winnings_rank INTEGER,
  win_percentage_rank INTEGER,
  total_entries_rank INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) + 1 FROM profiles WHERE total_winnings > p.total_winnings)::INTEGER,
    (SELECT COUNT(*) + 1 FROM profiles WHERE win_percentage > p.win_percentage AND total_entries >= 10)::INTEGER,
    (SELECT COUNT(*) + 1 FROM profiles WHERE total_entries > p.total_entries)::INTEGER
  FROM profiles p
  WHERE p.id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- USER PREFERENCES TABLE (OPTIONAL)
-- ============================================

-- For more complex user preferences, create separate table
CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  preference_key VARCHAR(50) NOT NULL,
  preference_value JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, preference_key)
);

-- Enable RLS on user preferences
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- Users can only access their own preferences
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage own preferences' AND tablename = 'user_preferences') THEN
        CREATE POLICY "Users can manage own preferences" ON user_preferences
          FOR ALL USING (auth.uid() = user_id)
          WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Show what columns were added
DO $$
DECLARE
    col_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO col_count
    FROM information_schema.columns
    WHERE table_name = 'profiles'
    AND column_name IN ('username', 'display_name', 'total_winnings', 'win_percentage', 'favorite_tracks');
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'ENHANCED USER PROFILES DEPLOYMENT COMPLETE!';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'New profile columns added: %', col_count;
    RAISE NOTICE 'User accounts now support:';
    RAISE NOTICE '✅ Custom usernames and display names';
    RAISE NOTICE '✅ Performance statistics tracking';
    RAISE NOTICE '✅ User preferences and personalization';
    RAISE NOTICE '✅ Social features foundation';
    RAISE NOTICE '✅ Subscription tier support';
    RAISE NOTICE '========================================';
END $$;
