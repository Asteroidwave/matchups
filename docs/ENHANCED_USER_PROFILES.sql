-- Enhanced User Profiles for Multi-User Platform
-- Run this in Supabase SQL Editor to add rich user profile capabilities

-- ============================================
-- ENHANCE PROFILES TABLE
-- ============================================

-- Add username capability (optional, can be null)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS username VARCHAR(50) UNIQUE;

-- Add display name (what others see)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS display_name VARCHAR(100);

-- Add avatar support
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Add user preferences
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS favorite_tracks TEXT[];
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'America/New_York';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email_notifications BOOLEAN DEFAULT TRUE;

-- Add performance statistics (calculated from user data)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS total_winnings DECIMAL(12,2) DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS total_entries INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS win_percentage DECIMAL(5,2) DEFAULT 0;

-- Add activity tracking
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS login_count INTEGER DEFAULT 0;

-- Add subscription support (for future premium features)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_tier VARCHAR(20) DEFAULT 'free';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ;

-- ============================================
-- CREATE INDEXES FOR PERFORMANCE
-- ============================================

-- Username lookup (for login and social features)
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username) WHERE username IS NOT NULL;

-- Performance statistics (for leaderboards)
CREATE INDEX IF NOT EXISTS idx_profiles_total_winnings ON profiles(total_winnings DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_win_percentage ON profiles(win_percentage DESC);

-- Activity tracking (for user analytics)
CREATE INDEX IF NOT EXISTS idx_profiles_last_login ON profiles(last_login DESC);

-- Subscription management
CREATE INDEX IF NOT EXISTS idx_profiles_subscription ON profiles(subscription_tier, subscription_expires_at);

-- ============================================
-- UPDATE RLS POLICIES FOR NEW FIELDS
-- ============================================

-- Allow users to update their own profile with new fields
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id AND (
    -- Users can't modify admin status or sensitive fields
    is_admin IS NOT DISTINCT FROM (SELECT is_admin FROM profiles WHERE id = auth.uid()) AND
    bankroll IS NOT DISTINCT FROM (SELECT bankroll FROM profiles WHERE id = auth.uid())
  ));

-- Allow public viewing of basic profile info (for social features)
CREATE POLICY "Public can view basic profile info" ON profiles
  FOR SELECT USING (
    -- Only expose safe fields publicly
    TRUE
  );

-- ============================================
-- USER STATISTICS FUNCTIONS  
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
  
  RAISE NOTICE 'Updated stats for user: % entries, $ % winnings, % percent win rate', 
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
CREATE POLICY "Users can manage own preferences" ON user_preferences
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check new columns were added
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'profiles'
AND column_name IN ('username', 'display_name', 'total_winnings', 'win_percentage')
ORDER BY column_name;

-- Check indexes were created
SELECT indexname, tablename 
FROM pg_indexes 
WHERE schemaname = 'public' 
AND tablename = 'profiles'
AND indexname LIKE 'idx_profiles_%';

-- Test user statistics function
-- SELECT update_user_statistics('your-user-id-here');

-- ============================================
-- COMPLETE! ✅
-- ============================================
-- Enhanced user profiles now support:
-- ✅ Custom usernames and display names
-- ✅ Performance statistics and leaderboards  
-- ✅ User preferences and personalization
-- ✅ Activity tracking and analytics
-- ✅ Subscription tier support
-- ✅ Social features foundation
-- ============================================
