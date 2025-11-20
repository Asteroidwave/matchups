-- =============================================================================
-- ENABLE RLS (Row Level Security) FOR ALL NEW RELATIONAL SCHEMA TABLES
-- =============================================================================
-- This is CRITICAL for security - prevents unauthorized data access
-- =============================================================================

-- Step 1: Enable RLS on all new schema tables
ALTER TABLE tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE horses ENABLE ROW LEVEL SECURITY;
ALTER TABLE connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE race_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE races ENABLE ROW LEVEL SECURITY;
ALTER TABLE race_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE race_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE contests ENABLE ROW LEVEL SECURITY;
ALTER TABLE contest_races ENABLE ROW LEVEL SECURITY;
ALTER TABLE matchup_pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE matchups ENABLE ROW LEVEL SECURITY;
ALTER TABLE matchup_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_picks ENABLE ROW LEVEL SECURITY;
ALTER TABLE rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_ingestion_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE entry_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_events ENABLE ROW LEVEL SECURITY;

-- profiles table should already have RLS, but ensure it's enabled
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- user_preferences table (if it exists - from enhanced profiles)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'user_preferences'
  ) THEN
    ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
    
    -- Create policy for user_preferences if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname = 'public' 
      AND tablename = 'user_preferences' 
      AND policyname = 'Users can manage own preferences'
    ) THEN
      CREATE POLICY "Users can manage own preferences" ON user_preferences
        FOR ALL USING (auth.uid() = user_id);
    END IF;
  END IF;
END $$;

-- =============================================================================
-- Step 2: Create RLS Policies for Public Data (Read-Only)
-- =============================================================================

-- Tracks: Public read access
CREATE POLICY "Tracks are viewable by everyone"
  ON tracks FOR SELECT
  USING (true);

-- Horses: Public read access
CREATE POLICY "Horses are viewable by everyone"
  ON horses FOR SELECT
  USING (true);

-- Connections: Public read access
CREATE POLICY "Connections are viewable by everyone"
  ON connections FOR SELECT
  USING (true);

-- Race Cards: Public read access
CREATE POLICY "Race cards are viewable by everyone"
  ON race_cards FOR SELECT
  USING (true);

-- Races: Public read access
CREATE POLICY "Races are viewable by everyone"
  ON races FOR SELECT
  USING (true);

-- Race Entries: Public read access
CREATE POLICY "Race entries are viewable by everyone"
  ON race_entries FOR SELECT
  USING (true);

-- Race Results: Public read access (after race is official)
CREATE POLICY "Race results are viewable by everyone"
  ON race_results FOR SELECT
  USING (true);

-- Contests: Public read access for active contests
-- NOTE: Run scripts/check-contests-schema.sql first to see which schema you have
-- Then uncomment the appropriate policy below:

-- OPTION 1: If your contests table has 'is_public' column (NEW schema)
-- Uncomment this:
/*
CREATE POLICY "Active contests are viewable by everyone"
  ON contests FOR SELECT
  USING (is_public = true OR status IN ('open', 'locked', 'live', 'draft'));
*/

-- OPTION 2: If your contests table has 'is_active' column (OLD schema)
-- Uncomment this instead:
CREATE POLICY "Active contests are viewable by everyone"
  ON contests FOR SELECT
  USING (is_active = true);

-- OPTION 3: If you want to allow all contests (no filtering)
-- Uncomment this instead:
/*
CREATE POLICY "Active contests are viewable by everyone"
  ON contests FOR SELECT
  USING (true);
*/

-- Contest Races: Public read access
CREATE POLICY "Contest races are viewable by everyone"
  ON contest_races FOR SELECT
  USING (true);

-- Matchup Pools: Public read access
CREATE POLICY "Matchup pools are viewable by everyone"
  ON matchup_pools FOR SELECT
  USING (true);

-- Matchups: Public read access
CREATE POLICY "Matchups are viewable by everyone"
  ON matchups FOR SELECT
  USING (true);

-- Matchup Entries: Public read access
CREATE POLICY "Matchup entries are viewable by everyone"
  ON matchup_entries FOR SELECT
  USING (true);

-- =============================================================================
-- Step 3: Create RLS Policies for User-Specific Data
-- =============================================================================

-- User Entries: Users can only see their own entries
CREATE POLICY "Users can view their own entries"
  ON user_entries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own entries"
  ON user_entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own entries"
  ON user_entries FOR UPDATE
  USING (auth.uid() = user_id);

-- User Picks: Users can only see their own picks
CREATE POLICY "Users can view their own picks"
  ON user_picks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_entries
      WHERE user_entries.id = user_picks.user_entry_id
      AND user_entries.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own picks"
  ON user_picks FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_entries
      WHERE user_entries.id = user_picks.user_entry_id
      AND user_entries.user_id = auth.uid()
    )
  );

-- Rounds: Users can only see their own rounds
CREATE POLICY "Users can view their own rounds"
  ON rounds FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_entries
      WHERE user_entries.id = rounds.user_entry_id
      AND user_entries.user_id = auth.uid()
    )
  );

-- Profiles: Users can view their own profile, admins can view all
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- =============================================================================
-- Step 4: Create RLS Policies for System/Admin Tables
-- =============================================================================

-- Data Ingestion Logs: Admins only
CREATE POLICY "Admins can view ingestion logs"
  ON data_ingestion_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Entry Changes: Users can see changes to their entries
CREATE POLICY "Users can view changes to their entries"
  ON entry_changes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_entries
      WHERE user_entries.id = entry_changes.user_entry_id
      AND user_entries.user_id = auth.uid()
    )
  );

-- System Events: Admins only
CREATE POLICY "Admins can view system events"
  ON system_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- =============================================================================
-- Step 5: Verify RLS is Enabled
-- =============================================================================

SELECT 
    tablename,
    CASE 
        WHEN (SELECT relrowsecurity FROM pg_class WHERE relname = tablename) 
        THEN '✅ ENABLED'
        ELSE '❌ DISABLED'
    END as rls_status,
    (SELECT COUNT(*) FROM pg_policies WHERE tablename = t.tablename) as policy_count
FROM pg_tables t
WHERE schemaname = 'public'
  AND tablename IN (
    'tracks', 'horses', 'connections', 'race_cards', 'races', 
    'race_entries', 'race_results', 'contests', 'contest_races',
    'matchup_pools', 'matchups', 'matchup_entries', 'user_entries',
    'user_picks', 'rounds', 'data_ingestion_logs', 'entry_changes',
    'system_events', 'profiles', 'user_preferences'
  )
ORDER BY tablename;
