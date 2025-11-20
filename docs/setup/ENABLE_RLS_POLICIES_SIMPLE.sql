-- =============================================================================
-- SIMPLE RLS POLICIES - Works with OLD schema (is_active)
-- =============================================================================
-- Use this if your contests table has 'is_active' column (old schema)
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
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Step 2: Public read access policies (create only if they don't exist)
DO $$
BEGIN
  -- Tracks
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'tracks' AND policyname = 'Tracks are viewable by everyone') THEN
    CREATE POLICY "Tracks are viewable by everyone" ON tracks FOR SELECT USING (true);
  END IF;
  
  -- Horses
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'horses' AND policyname = 'Horses are viewable by everyone') THEN
    CREATE POLICY "Horses are viewable by everyone" ON horses FOR SELECT USING (true);
  END IF;
  
  -- Connections
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'connections' AND policyname = 'Connections are viewable by everyone') THEN
    CREATE POLICY "Connections are viewable by everyone" ON connections FOR SELECT USING (true);
  END IF;
  
  -- Race cards
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'race_cards' AND policyname = 'Race cards are viewable by everyone') THEN
    CREATE POLICY "Race cards are viewable by everyone" ON race_cards FOR SELECT USING (true);
  END IF;
  
  -- Races
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'races' AND policyname = 'Races are viewable by everyone') THEN
    CREATE POLICY "Races are viewable by everyone" ON races FOR SELECT USING (true);
  END IF;
  
  -- Race entries
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'race_entries' AND policyname = 'Race entries are viewable by everyone') THEN
    CREATE POLICY "Race entries are viewable by everyone" ON race_entries FOR SELECT USING (true);
  END IF;
  
  -- Race results
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'race_results' AND policyname = 'Race results are viewable by everyone') THEN
    CREATE POLICY "Race results are viewable by everyone" ON race_results FOR SELECT USING (true);
  END IF;
  
  -- Contest races
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'contest_races' AND policyname = 'Contest races are viewable by everyone') THEN
    CREATE POLICY "Contest races are viewable by everyone" ON contest_races FOR SELECT USING (true);
  END IF;
  
  -- Matchup pools
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'matchup_pools' AND policyname = 'Matchup pools are viewable by everyone') THEN
    CREATE POLICY "Matchup pools are viewable by everyone" ON matchup_pools FOR SELECT USING (true);
  END IF;
  
  -- Matchups
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'matchups' AND policyname = 'Matchups are viewable by everyone') THEN
    CREATE POLICY "Matchups are viewable by everyone" ON matchups FOR SELECT USING (true);
  END IF;
  
  -- Matchup entries
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'matchup_entries' AND policyname = 'Matchup entries are viewable by everyone') THEN
    CREATE POLICY "Matchup entries are viewable by everyone" ON matchup_entries FOR SELECT USING (true);
  END IF;
  
  -- Contests: Use is_active (old schema)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'contests' AND policyname = 'Active contests are viewable by everyone') THEN
    CREATE POLICY "Active contests are viewable by everyone" ON contests FOR SELECT USING (is_active = true);
  END IF;
END $$;

-- Step 3: User-specific policies (create only if they don't exist)
DO $$
BEGIN
  -- User entries
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_entries' AND policyname = 'Users can view their own entries') THEN
    CREATE POLICY "Users can view their own entries" ON user_entries FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_entries' AND policyname = 'Users can insert their own entries') THEN
    CREATE POLICY "Users can insert their own entries" ON user_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_entries' AND policyname = 'Users can update their own entries') THEN
    CREATE POLICY "Users can update their own entries" ON user_entries FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  
  -- User picks
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_picks' AND policyname = 'Users can view their own picks') THEN
    CREATE POLICY "Users can view their own picks" ON user_picks FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM user_entries
          WHERE user_entries.id = user_picks.user_entry_id
          AND user_entries.user_id = auth.uid()
        )
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_picks' AND policyname = 'Users can insert their own picks') THEN
    CREATE POLICY "Users can insert their own picks" ON user_picks FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM user_entries
          WHERE user_entries.id = user_picks.user_entry_id
          AND user_entries.user_id = auth.uid()
        )
      );
  END IF;
  
  -- Rounds
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'rounds' AND policyname = 'Users can view their own rounds') THEN
    CREATE POLICY "Users can view their own rounds" ON rounds FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM user_entries
          WHERE user_entries.id = rounds.user_entry_id
          AND user_entries.user_id = auth.uid()
        )
      );
  END IF;
  
  -- Profiles
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'Users can view their own profile') THEN
    CREATE POLICY "Users can view their own profile" ON profiles FOR SELECT USING (auth.uid() = id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'Admins can view all profiles') THEN
    CREATE POLICY "Admins can view all profiles" ON profiles FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.is_admin = true
        )
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'Users can update their own profile') THEN
    CREATE POLICY "Users can update their own profile" ON profiles FOR UPDATE
      USING (auth.uid() = id)
      WITH CHECK (auth.uid() = id);
  END IF;
END $$;

-- Step 4: Admin-only policies (create only if they don't exist)
DO $$
BEGIN
  -- Data ingestion logs
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'data_ingestion_logs' AND policyname = 'Admins can view ingestion logs') THEN
    CREATE POLICY "Admins can view ingestion logs" ON data_ingestion_logs FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.is_admin = true
        )
      );
  END IF;
  
  -- Entry changes: tracks changes to race entries (public data)
  -- Since race entries are public, entry changes should be viewable by everyone
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'entry_changes' AND policyname = 'Entry changes are viewable by everyone') THEN
    CREATE POLICY "Entry changes are viewable by everyone" ON entry_changes FOR SELECT USING (true);
  END IF;
  
  -- System events
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'system_events' AND policyname = 'Admins can view system events') THEN
    CREATE POLICY "Admins can view system events" ON system_events FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.is_admin = true
        )
      );
  END IF;
END $$;

-- Step 5: user_preferences (if exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'user_preferences'
  ) THEN
    ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
    
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
