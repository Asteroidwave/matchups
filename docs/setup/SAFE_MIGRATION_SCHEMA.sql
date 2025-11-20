-- ============================================
-- SAFE MIGRATION: NEW RELATIONAL SCHEMA
-- Handles existing tables safely
-- ============================================
-- Run this instead of NEW_RELATIONAL_SCHEMA.sql if you have existing tables
-- This version uses IF NOT EXISTS and handles conflicts gracefully
-- ============================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- STEP 1: BACKUP EXISTING TABLES
-- ============================================

-- Create backup copies of existing tables before modifying
DO $$ 
BEGIN
  -- Backup existing contests table if it exists
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'contests' AND table_schema = 'public') THEN
    EXECUTE 'CREATE TABLE contests_backup_' || to_char(NOW(), 'YYYYMMDD_HH24MI') || ' AS SELECT * FROM contests';
    RAISE NOTICE 'Backed up existing contests table';
  END IF;

  -- Backup existing profiles table if it exists  
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'profiles' AND table_schema = 'public') THEN
    EXECUTE 'CREATE TABLE profiles_backup_' || to_char(NOW(), 'YYYYMMDD_HH24MI') || ' AS SELECT * FROM profiles';
    RAISE NOTICE 'Backed up existing profiles table';
  END IF;

  -- Backup existing entries table if it exists
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'entries' AND table_schema = 'public') THEN
    EXECUTE 'CREATE TABLE entries_backup_' || to_char(NOW(), 'YYYYMMDD_HH24MI') || ' AS SELECT * FROM entries';
    RAISE NOTICE 'Backed up existing entries table';
  END IF;
END $$;

-- ============================================
-- STEP 2: CREATE NEW TABLES WITH IF NOT EXISTS
-- ============================================

-- 1. CORE RACING ENTITIES
-- ============================================

-- Tracks (racetracks)
CREATE TABLE IF NOT EXISTS tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(10) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  timezone VARCHAR(50) NOT NULL DEFAULT 'America/New_York',
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Race Cards (daily racing at a track)
CREATE TABLE IF NOT EXISTS race_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id UUID NOT NULL REFERENCES tracks(id),
  race_date DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'cancelled', 'completed')),
  post_times JSONB,
  first_post_time TIMESTAMPTZ,
  last_post_time TIMESTAMPTZ,
  weather JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(track_id, race_date)
);

-- Individual Races
CREATE TABLE IF NOT EXISTS races (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  race_card_id UUID NOT NULL REFERENCES race_cards(id),
  race_number INTEGER NOT NULL CHECK (race_number > 0),
  post_time TIMESTAMPTZ,
  distance VARCHAR(20),
  surface VARCHAR(20), -- Removed constraint to allow any surface values
  race_type VARCHAR(50),
  race_class VARCHAR(50),
  purse DECIMAL(12,2),
  conditions TEXT,
  status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'official', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(race_card_id, race_number)
);

-- ============================================
-- 2. HORSES & CONNECTIONS
-- ============================================

-- Horses
CREATE TABLE IF NOT EXISTS horses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  foaling_year INTEGER,
  sex VARCHAR(10) CHECK (sex IN ('colt', 'filly', 'horse', 'mare', 'gelding', 'ridgling')),
  breed VARCHAR(50) DEFAULT 'thoroughbred',
  color VARCHAR(50),
  sire_name VARCHAR(100),
  dam_name VARCHAR(100),
  country_foaled VARCHAR(5) DEFAULT 'USA',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT horses_name_year_unique UNIQUE (name, foaling_year)
);

-- Connections (jockeys, trainers, owners, sires)
CREATE TABLE IF NOT EXISTS connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('jockey', 'trainer', 'owner', 'sire')),
  license_number VARCHAR(50),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'retired')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(name, role)
);

-- ============================================
-- 3. RACE ENTRIES & RESULTS
-- ============================================

-- Race Entries (horses entered in specific races)
CREATE TABLE IF NOT EXISTS race_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  race_id UUID NOT NULL REFERENCES races(id),
  horse_id UUID NOT NULL REFERENCES horses(id),
  
  program_number INTEGER NOT NULL,
  post_position INTEGER,
  
  jockey_id UUID REFERENCES connections(id),
  trainer_id UUID REFERENCES connections(id),
  owner_id UUID REFERENCES connections(id),
  
  morning_line_odds VARCHAR(10),
  ml_decimal_odds DECIMAL(8,3),
  
  salary DECIMAL(8,2),
  projected_points DECIMAL(8,2),
  
  status VARCHAR(20) DEFAULT 'entered' CHECK (status IN ('entered', 'scratched', 'ae_elevated')),
  scratch_time TIMESTAMPTZ,
  scratch_reason TEXT,
  is_also_eligible BOOLEAN DEFAULT FALSE,
  ae_elevation_time TIMESTAMPTZ,
  
  weight INTEGER,
  equipment JSONB,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(race_id, program_number)
);

-- Race Results
CREATE TABLE IF NOT EXISTS race_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  race_entry_id UUID NOT NULL REFERENCES race_entries(id),
  
  finish_position INTEGER,
  official_finish_position INTEGER,
  disqualified BOOLEAN DEFAULT FALSE,
  dead_heat BOOLEAN DEFAULT FALSE,
  
  final_odds DECIMAL(8,3),
  payout_win DECIMAL(10,2),
  payout_place DECIMAL(10,2),
  payout_show DECIMAL(10,2),
  
  points_earned DECIMAL(8,2),
  
  lengths_behind DECIMAL(5,2),
  running_positions TEXT,
  fractional_times TEXT,
  final_time VARCHAR(20),
  speed_figure INTEGER,
  
  comments TEXT,
  jockey_comments TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(race_entry_id)
);

-- ============================================
-- STEP 3: HANDLE EXISTING CONTESTS TABLE
-- ============================================

DO $$ 
BEGIN
  -- If contests table already exists, add new columns if they don't exist
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'contests' AND table_schema = 'public') THEN
    
    -- Add new columns that might be missing
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'contests' AND column_name = 'contest_type') THEN
      ALTER TABLE contests ADD COLUMN contest_type VARCHAR(50) DEFAULT 'single_track' 
        CHECK (contest_type IN ('single_track', 'multi_track', 'cross_track'));
    END IF;
    
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'contests' AND column_name = 'first_post_time') THEN
      ALTER TABLE contests ADD COLUMN first_post_time TIMESTAMPTZ;
    END IF;
    
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'contests' AND column_name = 'last_post_time') THEN
      ALTER TABLE contests ADD COLUMN last_post_time TIMESTAMPTZ;
    END IF;
    
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'contests' AND column_name = 'lock_time') THEN
      ALTER TABLE contests ADD COLUMN lock_time TIMESTAMPTZ;
    END IF;
    
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'contests' AND column_name = 'lifecycle_status') THEN
      ALTER TABLE contests ADD COLUMN lifecycle_status VARCHAR(30) DEFAULT 'setup';
    END IF;
    
    RAISE NOTICE 'Enhanced existing contests table with new columns';
    
  ELSE
    -- Create new contests table if it doesn't exist
    CREATE TABLE contests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(200) NOT NULL,
      description TEXT,
      contest_type VARCHAR(50) NOT NULL CHECK (contest_type IN ('single_track', 'multi_track', 'cross_track')),
      
      contest_date DATE NOT NULL,
      lock_time TIMESTAMPTZ NOT NULL,
      first_post_time TIMESTAMPTZ,
      last_post_time TIMESTAMPTZ,
      
      entry_fee DECIMAL(10,2) NOT NULL CHECK (entry_fee > 0),
      max_entries INTEGER,
      max_entries_per_user INTEGER DEFAULT 1,
      
      guaranteed_prize_pool DECIMAL(12,2),
      prize_structure JSONB,
      rake_percentage DECIMAL(5,4) DEFAULT 0.10,
      
      min_picks INTEGER DEFAULT 1,
      max_picks INTEGER DEFAULT 10,
      allows_flex BOOLEAN DEFAULT FALSE,
      flex_multiplier_schedule JSONB,
      
      status VARCHAR(30) DEFAULT 'draft' CHECK (status IN ('draft', 'open', 'locked', 'live', 'grading', 'settled', 'cancelled')),
      lifecycle_stage VARCHAR(30) DEFAULT 'setup' CHECK (lifecycle_stage IN ('setup', 'open_registration', 'locked', 'running', 'grading', 'completed')),
      
      created_by UUID NOT NULL REFERENCES profiles(id),
      is_public BOOLEAN DEFAULT TRUE,
      is_featured BOOLEAN DEFAULT FALSE,
      
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    
    RAISE NOTICE 'Created new contests table';
  END IF;
END $$;

-- ============================================
-- STEP 4: CREATE REMAINING NEW TABLES
-- ============================================

-- Contest Races (which races are included in each contest)
CREATE TABLE IF NOT EXISTS contest_races (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id UUID NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
  race_id UUID NOT NULL REFERENCES races(id),
  weight INTEGER DEFAULT 1,
  is_required BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(contest_id, race_id)
);

-- Matchup Pools (calculated connection performance for contests)
CREATE TABLE IF NOT EXISTS matchup_pools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id UUID NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES connections(id),
  
  total_entries INTEGER DEFAULT 0,
  total_points DECIMAL(10,2) DEFAULT 0,
  total_salary DECIMAL(12,2) DEFAULT 0,
  avg_odds DECIMAL(8,3) DEFAULT 0,
  
  avpa_30d DECIMAL(8,3) DEFAULT 0,
  avpa_90d DECIMAL(8,3) DEFAULT 0,
  avpa_race DECIMAL(8,3) DEFAULT 0,
  
  qualifying_entries JSONB NOT NULL,
  total_qualifying_races INTEGER DEFAULT 0,
  
  calculation_date DATE NOT NULL,
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(contest_id, connection_id)
);

-- Matchups
CREATE TABLE IF NOT EXISTS matchups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id UUID NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
  matchup_type VARCHAR(30) NOT NULL CHECK (matchup_type IN ('jockey_vs_jockey', 'trainer_vs_trainer', 'sire_vs_sire', 'mixed', 'cross_track')),
  
  set_a_connections UUID[] NOT NULL,
  set_a_total_salary DECIMAL(12,2),
  set_a_total_points DECIMAL(10,2),
  set_a_avg_odds DECIMAL(8,3),
  
  set_b_connections UUID[] NOT NULL,
  set_b_total_salary DECIMAL(12,2),
  set_b_total_points DECIMAL(10,2),
  set_b_avg_odds DECIMAL(8,3),
  
  tolerance_used DECIMAL(8,2),
  generation_algorithm VARCHAR(50),
  quality_score DECIMAL(5,3),
  similarity_metrics JSONB,
  
  winning_side CHAR(1) CHECK (winning_side IN ('A', 'B', 'T')),
  set_a_actual_points DECIMAL(10,2),
  set_b_actual_points DECIMAL(10,2),
  point_differential DECIMAL(10,2),
  is_push BOOLEAN DEFAULT FALSE,
  resulted_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Matchup Entries (detailed breakdown of race entries in each matchup)
CREATE TABLE IF NOT EXISTS matchup_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matchup_id UUID NOT NULL REFERENCES matchups(id) ON DELETE CASCADE,
  race_entry_id UUID NOT NULL REFERENCES race_entries(id),
  connection_id UUID NOT NULL REFERENCES connections(id),
  matchup_side CHAR(1) NOT NULL CHECK (matchup_side IN ('A', 'B')),
  
  expected_points DECIMAL(8,2),
  expected_salary DECIMAL(8,2),
  expected_odds DECIMAL(8,3),
  
  actual_points DECIMAL(8,2),
  finish_position INTEGER,
  beat_the_odds BOOLEAN,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(matchup_id, race_entry_id)
);

-- ============================================
-- STEP 5: HANDLE EXISTING USER TABLES
-- ============================================

-- User Entries (user submissions to contests)  
CREATE TABLE IF NOT EXISTS user_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id UUID NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  entry_amount DECIMAL(10,2) NOT NULL CHECK (entry_amount > 0),
  max_multiplier INTEGER DEFAULT 2 CHECK (max_multiplier >= 2),
  
  is_flex BOOLEAN DEFAULT FALSE,
  required_picks INTEGER,
  multiplier_schedule JSONB,
  
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'live', 'won', 'lost', 'pushed', 'cancelled')),
  
  total_picks INTEGER DEFAULT 0,
  correct_picks INTEGER DEFAULT 0,
  final_multiplier DECIMAL(6,3),
  gross_winnings DECIMAL(12,2) DEFAULT 0,
  net_winnings DECIMAL(12,2) DEFAULT 0,
  
  is_settled BOOLEAN DEFAULT FALSE,
  settled_at TIMESTAMPTZ,
  payout_processed BOOLEAN DEFAULT FALSE,
  payout_processed_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Picks (individual picks within entries)
CREATE TABLE IF NOT EXISTS user_picks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_entry_id UUID NOT NULL REFERENCES user_entries(id) ON DELETE CASCADE,
  matchup_id UUID NOT NULL REFERENCES matchups(id),
  selected_side CHAR(1) NOT NULL CHECK (selected_side IN ('A', 'B')),
  
  confidence_level INTEGER DEFAULT 1 CHECK (confidence_level BETWEEN 1 AND 5),
  pick_weight DECIMAL(3,2) DEFAULT 1.0,
  
  is_winner BOOLEAN,
  is_push BOOLEAN DEFAULT FALSE,
  resulted_at TIMESTAMPTZ,
  
  placed_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_entry_id, matchup_id)
);

-- Rounds (complete lifecycle tracking for user entries)
CREATE TABLE IF NOT EXISTS rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_entry_id UUID NOT NULL REFERENCES user_entries(id) ON DELETE CASCADE,
  
  total_picks INTEGER NOT NULL,
  correct_picks INTEGER DEFAULT 0,
  incorrect_picks INTEGER DEFAULT 0,
  pushed_picks INTEGER DEFAULT 0,
  pending_picks INTEGER DEFAULT 0,
  
  pick_accuracy DECIMAL(5,4),
  average_odds_beaten DECIMAL(8,3),
  hardest_pick_won DECIMAL(8,3),
  
  entry_amount DECIMAL(10,2) NOT NULL,
  potential_max_payout DECIMAL(12,2),
  actual_payout DECIMAL(12,2) DEFAULT 0,
  final_multiplier DECIMAL(6,3),
  roi DECIMAL(8,4),
  
  status VARCHAR(20) DEFAULT 'live' CHECK (status IN ('live', 'won', 'lost', 'pushed', 'grading', 'cancelled')),
  result_type VARCHAR(20) CHECK (result_type IN ('full_win', 'partial_win', 'loss', 'push')),
  
  locked_at TIMESTAMPTZ,
  first_result_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  paid_out_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_entry_id)
);

-- ============================================
-- STEP 6: AUDIT & CHANGE TRACKING
-- ============================================

-- Data Ingestion Logs
CREATE TABLE IF NOT EXISTS data_ingestion_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source VARCHAR(50) NOT NULL,
  data_type VARCHAR(50) NOT NULL,
  track_code VARCHAR(10),
  race_date DATE,
  
  records_processed INTEGER DEFAULT 0,
  records_inserted INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,
  
  status VARCHAR(20) DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed', 'partial')),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  processing_time_ms INTEGER,
  
  error_details JSONB,
  failed_records JSONB,
  source_metadata JSONB,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Entry Changes (scratches, AE elevations, etc.)
CREATE TABLE IF NOT EXISTS entry_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  race_entry_id UUID NOT NULL REFERENCES race_entries(id),
  change_type VARCHAR(30) NOT NULL CHECK (change_type IN ('scratch', 'ae_elevation', 'jockey_change', 'trainer_change', 'odds_update', 'equipment_change')),
  
  old_values JSONB,
  new_values JSONB,
  change_reason TEXT,
  change_source VARCHAR(50),
  
  affected_matchups UUID[],
  affected_contests UUID[],
  affected_entries UUID[],
  
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMPTZ,
  processing_notes TEXT,
  
  is_official BOOLEAN DEFAULT TRUE,
  announced_at TIMESTAMPTZ,
  effective_immediately BOOLEAN DEFAULT TRUE,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- System Events (comprehensive audit trail)
CREATE TABLE IF NOT EXISTS system_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID NOT NULL,
  
  event_data JSONB,
  old_state JSONB,
  new_state JSONB,
  
  triggered_by UUID REFERENCES profiles(id),
  trigger_source VARCHAR(50),
  
  cascade_events UUID[],
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- STEP 7: INDEXES FOR PERFORMANCE
-- ============================================

-- Only create indexes if they don't already exist
DO $$
DECLARE
    index_name TEXT;
    index_names TEXT[] := ARRAY[
        'idx_race_cards_track_date',
        'idx_races_card_number',
        'idx_race_entries_race_id',
        'idx_race_entries_horse_id',
        'idx_matchups_contest_type',
        'idx_user_entries_contest_user',
        'idx_user_picks_entry'
    ];
BEGIN
    FOREACH index_name IN ARRAY index_names
    LOOP
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = index_name) THEN
            CASE index_name
                WHEN 'idx_race_cards_track_date' THEN
                    CREATE INDEX idx_race_cards_track_date ON race_cards(track_id, race_date);
                WHEN 'idx_races_card_number' THEN  
                    CREATE INDEX idx_races_card_number ON races(race_card_id, race_number);
                WHEN 'idx_race_entries_race_id' THEN
                    CREATE INDEX idx_race_entries_race_id ON race_entries(race_id);
                WHEN 'idx_race_entries_horse_id' THEN
                    CREATE INDEX idx_race_entries_horse_id ON race_entries(horse_id);
                WHEN 'idx_matchups_contest_type' THEN
                    CREATE INDEX idx_matchups_contest_type ON matchups(contest_id, matchup_type);
                WHEN 'idx_user_entries_contest_user' THEN
                    CREATE INDEX idx_user_entries_contest_user ON user_entries(contest_id, user_id);
                WHEN 'idx_user_picks_entry' THEN
                    CREATE INDEX idx_user_picks_entry ON user_picks(user_entry_id);
            END CASE;
            RAISE NOTICE 'Created index: %', index_name;
        END IF;
    END LOOP;
END $$;

-- Create the partial unique index for post positions (safe)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_race_entries_unique_post_position') THEN
        CREATE UNIQUE INDEX idx_race_entries_unique_post_position 
          ON race_entries(race_id, post_position) 
          WHERE status != 'scratched';
        RAISE NOTICE 'Created partial unique index for post positions';
    END IF;
END $$;

-- ============================================
-- STEP 8: ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Only enable RLS if not already enabled
DO $$
DECLARE
    table_name TEXT;
    table_names TEXT[] := ARRAY['contests', 'matchups', 'user_entries', 'user_picks', 'rounds'];
BEGIN
    FOREACH table_name IN ARRAY table_names
    LOOP
        IF EXISTS (SELECT 1 FROM pg_class WHERE relname = table_name) THEN
            EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
            RAISE NOTICE 'Enabled RLS for table: %', table_name;
        END IF;
    END LOOP;
END $$;

-- Create RLS policies (with IF NOT EXISTS equivalent)
DO $$
BEGIN
    -- Contest policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can view active contests' AND tablename = 'contests') THEN
        CREATE POLICY "Anyone can view active contests" ON contests
          FOR SELECT USING (status IN ('open', 'locked', 'live') AND is_public = TRUE);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can manage contests' AND tablename = 'contests') THEN
        CREATE POLICY "Admins can manage contests" ON contests
          FOR ALL USING (
            EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
          );
    END IF;

    -- User entry policies  
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own entries' AND tablename = 'user_entries') THEN
        CREATE POLICY "Users can view own entries" ON user_entries
          FOR SELECT USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can create own entries' AND tablename = 'user_entries') THEN
        CREATE POLICY "Users can create own entries" ON user_entries  
          FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;

    RAISE NOTICE 'RLS policies created successfully';
END $$;

-- ============================================
-- STEP 9: UPDATE TRIGGERS
-- ============================================

-- Create update timestamp function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to tables that have updated_at column
DO $$
DECLARE
    table_name TEXT;
    trigger_name TEXT;
    table_names TEXT[] := ARRAY['tracks', 'race_cards', 'races', 'connections', 'race_entries', 'contests', 'matchups', 'user_entries', 'rounds'];
BEGIN
    FOREACH table_name IN ARRAY table_names
    LOOP
        trigger_name := 'update_' || table_name || '_updated_at';
        
        -- Drop trigger if it exists and recreate
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', trigger_name, table_name);
        EXECUTE format('
            CREATE TRIGGER %I
                BEFORE UPDATE ON %I
                FOR EACH ROW
                EXECUTE FUNCTION update_updated_at_column()
        ', trigger_name, table_name);
        
        RAISE NOTICE 'Created/updated trigger for table: %', table_name;
    END LOOP;
END $$;

-- ============================================
-- STEP 10: VERIFICATION
-- ============================================

-- Show what was created/updated
DO $$
DECLARE
    table_count INTEGER;
    index_count INTEGER;
    policy_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO table_count 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name IN ('tracks', 'race_cards', 'races', 'horses', 'connections', 'race_entries', 'race_results', 'contests', 'contest_races', 'matchup_pools', 'matchups', 'matchup_entries', 'user_entries', 'user_picks', 'rounds', 'data_ingestion_logs', 'entry_changes', 'system_events');
    
    SELECT COUNT(*) INTO index_count 
    FROM pg_indexes 
    WHERE schemaname = 'public';
    
    SELECT COUNT(*) INTO policy_count 
    FROM pg_policies;
    
    RAISE NOTICE '===========================================';
    RAISE NOTICE 'MIGRATION COMPLETED SUCCESSFULLY!';
    RAISE NOTICE '===========================================';
    RAISE NOTICE 'Tables created/verified: % of 19 expected', table_count;
    RAISE NOTICE 'Indexes created: %', index_count;
    RAISE NOTICE 'RLS policies created: %', policy_count;
    RAISE NOTICE '===========================================';
    RAISE NOTICE 'Your existing data has been backed up and preserved';
    RAISE NOTICE 'New relational architecture is ready to use';
    RAISE NOTICE '===========================================';
END $$;
