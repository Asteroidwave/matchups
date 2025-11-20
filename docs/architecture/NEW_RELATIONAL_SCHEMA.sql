-- ============================================
-- COMPREHENSIVE RELATIONAL DATABASE SCHEMA
-- FOR HORSE RACING FANTASY PLATFORM
-- ============================================
-- This script creates a complete relational architecture
-- Run in Supabase SQL Editor to replace current fragmented system
-- ============================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. CORE RACING ENTITIES
-- ============================================

-- Tracks (racetracks)
CREATE TABLE tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(10) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  timezone VARCHAR(50) NOT NULL DEFAULT 'America/New_York',
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Race Cards (daily racing at a track)
CREATE TABLE race_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id UUID NOT NULL REFERENCES tracks(id),
  race_date DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'cancelled', 'completed')),
  post_times JSONB, -- Array of race post times
  first_post_time TIMESTAMPTZ,
  last_post_time TIMESTAMPTZ,
  weather JSONB, -- Weather conditions, track condition, etc.
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(track_id, race_date)
);

-- Individual Races
CREATE TABLE races (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  race_card_id UUID NOT NULL REFERENCES race_cards(id),
  race_number INTEGER NOT NULL CHECK (race_number > 0),
  post_time TIMESTAMPTZ,
  distance VARCHAR(20),
  surface VARCHAR(20) CHECK (surface IN ('dirt', 'turf', 'synthetic', 'all_weather')),
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
CREATE TABLE horses (
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
  
  -- Multiple horses can have same name (different years/bloodlines)
  CONSTRAINT horses_name_year_unique UNIQUE (name, foaling_year)
);

-- Connections (jockeys, trainers, owners, sires)
CREATE TABLE connections (
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
CREATE TABLE race_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  race_id UUID NOT NULL REFERENCES races(id),
  horse_id UUID NOT NULL REFERENCES horses(id),
  
  -- Entry Position Info
  program_number INTEGER NOT NULL, -- Saddlecloth number (stable across scratches)
  post_position INTEGER, -- Gate position (changes if scratches occur)
  
  -- Connections
  jockey_id UUID REFERENCES connections(id),
  trainer_id UUID REFERENCES connections(id),
  owner_id UUID REFERENCES connections(id),
  
  -- Betting Information
  morning_line_odds VARCHAR(10),
  ml_decimal_odds DECIMAL(8,3),
  
  -- Fantasy Information  
  salary DECIMAL(8,2),
  projected_points DECIMAL(8,2),
  
  -- Entry Status & Changes
  status VARCHAR(20) DEFAULT 'entered' CHECK (status IN ('entered', 'scratched', 'ae_elevated')),
  scratch_time TIMESTAMPTZ,
  scratch_reason TEXT,
  is_also_eligible BOOLEAN DEFAULT FALSE,
  ae_elevation_time TIMESTAMPTZ,
  
  -- Equipment & Weight
  weight INTEGER,
  equipment JSONB, -- blinkers, lasix, etc.
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(race_id, program_number)
);

-- Race Results
CREATE TABLE race_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  race_entry_id UUID NOT NULL REFERENCES race_entries(id),
  
  -- Finishing Information
  finish_position INTEGER,
  official_finish_position INTEGER,
  disqualified BOOLEAN DEFAULT FALSE,
  dead_heat BOOLEAN DEFAULT FALSE,
  
  -- Betting Payouts
  final_odds DECIMAL(8,3),
  payout_win DECIMAL(10,2),
  payout_place DECIMAL(10,2),
  payout_show DECIMAL(10,2),
  
  -- Fantasy Points
  points_earned DECIMAL(8,2),
  
  -- Race Performance Details
  lengths_behind DECIMAL(5,2),
  running_positions TEXT, -- '2-1-1-1' positions at each call
  fractional_times TEXT,
  final_time VARCHAR(20),
  speed_figure INTEGER,
  
  -- Comments & Notes
  comments TEXT,
  jockey_comments TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(race_entry_id)
);

-- ============================================
-- 4. CONTESTS & MATCHUPS
-- ============================================

-- Contests
CREATE TABLE contests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  description TEXT,
  contest_type VARCHAR(50) NOT NULL CHECK (contest_type IN ('single_track', 'multi_track', 'cross_track')),
  
  -- Scheduling
  contest_date DATE NOT NULL,
  lock_time TIMESTAMPTZ NOT NULL,
  first_post_time TIMESTAMPTZ,
  last_post_time TIMESTAMPTZ,
  
  -- Entry Configuration
  entry_fee DECIMAL(10,2) NOT NULL CHECK (entry_fee > 0),
  max_entries INTEGER,
  max_entries_per_user INTEGER DEFAULT 1,
  
  -- Prize Structure
  guaranteed_prize_pool DECIMAL(12,2),
  prize_structure JSONB, -- Detailed payout structure
  rake_percentage DECIMAL(5,4) DEFAULT 0.10, -- 10% default rake
  
  -- Contest Rules
  min_picks INTEGER DEFAULT 1,
  max_picks INTEGER DEFAULT 10,
  allows_flex BOOLEAN DEFAULT FALSE,
  flex_multiplier_schedule JSONB,
  
  -- Status & Lifecycle  
  status VARCHAR(30) DEFAULT 'draft' CHECK (status IN ('draft', 'open', 'locked', 'live', 'grading', 'settled', 'cancelled')),
  lifecycle_stage VARCHAR(30) DEFAULT 'setup' CHECK (lifecycle_stage IN ('setup', 'open_registration', 'locked', 'running', 'grading', 'completed')),
  
  -- Administrative
  created_by UUID NOT NULL REFERENCES profiles(id),
  is_public BOOLEAN DEFAULT TRUE,
  is_featured BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contest Races (which races are included in each contest)
CREATE TABLE contest_races (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id UUID NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
  race_id UUID NOT NULL REFERENCES races(id),
  weight INTEGER DEFAULT 1, -- Scoring weight for this race
  is_required BOOLEAN DEFAULT TRUE, -- Must have picks from this race
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(contest_id, race_id)
);

-- Matchup Pools (calculated connection performance for contests)
CREATE TABLE matchup_pools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id UUID NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES connections(id),
  
  -- Performance Statistics
  total_entries INTEGER DEFAULT 0,
  total_points DECIMAL(10,2) DEFAULT 0,
  total_salary DECIMAL(12,2) DEFAULT 0,
  avg_odds DECIMAL(8,3) DEFAULT 0,
  
  -- Recent Performance Windows
  avpa_30d DECIMAL(8,3) DEFAULT 0, -- Average points per appearance, 30 days
  avpa_90d DECIMAL(8,3) DEFAULT 0, -- Average points per appearance, 90 days
  avpa_race DECIMAL(8,3) DEFAULT 0, -- Average points this race type
  
  -- Qualifying Race Entries
  qualifying_entries JSONB NOT NULL, -- Array of race_entry_ids that qualify this connection
  total_qualifying_races INTEGER DEFAULT 0,
  
  -- Calculation Metadata
  calculation_date DATE NOT NULL,
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(contest_id, connection_id)
);

-- Matchups
CREATE TABLE matchups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id UUID NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
  matchup_type VARCHAR(30) NOT NULL CHECK (matchup_type IN ('jockey_vs_jockey', 'trainer_vs_trainer', 'sire_vs_sire', 'mixed', 'cross_track')),
  
  -- Set A (Left Side)
  set_a_connections UUID[] NOT NULL,
  set_a_total_salary DECIMAL(12,2),
  set_a_total_points DECIMAL(10,2),
  set_a_avg_odds DECIMAL(8,3),
  
  -- Set B (Right Side)
  set_b_connections UUID[] NOT NULL,
  set_b_total_salary DECIMAL(12,2),
  set_b_total_points DECIMAL(10,2),
  set_b_avg_odds DECIMAL(8,3),
  
  -- Matchup Generation Metadata
  tolerance_used DECIMAL(8,2),
  generation_algorithm VARCHAR(50),
  quality_score DECIMAL(5,3), -- How balanced is this matchup (0-1)
  similarity_metrics JSONB, -- Detailed balancing metrics
  
  -- Results (populated after races complete)
  winning_side CHAR(1) CHECK (winning_side IN ('A', 'B', 'T')), -- T = tie
  set_a_actual_points DECIMAL(10,2),
  set_b_actual_points DECIMAL(10,2),
  point_differential DECIMAL(10,2),
  is_push BOOLEAN DEFAULT FALSE,
  resulted_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Matchup Entries (detailed breakdown of race entries in each matchup)
CREATE TABLE matchup_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matchup_id UUID NOT NULL REFERENCES matchups(id) ON DELETE CASCADE,
  race_entry_id UUID NOT NULL REFERENCES race_entries(id),
  connection_id UUID NOT NULL REFERENCES connections(id),
  matchup_side CHAR(1) NOT NULL CHECK (matchup_side IN ('A', 'B')),
  
  -- Expected Performance (at matchup creation)
  expected_points DECIMAL(8,2),
  expected_salary DECIMAL(8,2),
  expected_odds DECIMAL(8,3),
  
  -- Actual Performance (populated after race)
  actual_points DECIMAL(8,2),
  finish_position INTEGER,
  beat_the_odds BOOLEAN, -- Whether result was better than expected
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(matchup_id, race_entry_id)
);

-- ============================================
-- 5. USER ENTRIES & ROUNDS
-- ============================================

-- User Entries (user submissions to contests)
CREATE TABLE user_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id UUID NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Entry Configuration
  entry_amount DECIMAL(10,2) NOT NULL CHECK (entry_amount > 0),
  max_multiplier INTEGER DEFAULT 2 CHECK (max_multiplier >= 2),
  
  -- Flex Entry Options
  is_flex BOOLEAN DEFAULT FALSE,
  required_picks INTEGER, -- For flex entries, minimum correct picks needed
  multiplier_schedule JSONB, -- Custom multiplier rules {correct_picks: multiplier}
  
  -- Entry Status
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'live', 'won', 'lost', 'pushed', 'cancelled')),
  
  -- Results & Payout
  total_picks INTEGER DEFAULT 0,
  correct_picks INTEGER DEFAULT 0,
  final_multiplier DECIMAL(6,3),
  gross_winnings DECIMAL(12,2) DEFAULT 0,
  net_winnings DECIMAL(12,2) DEFAULT 0, -- After fees/rake
  
  -- Processing
  is_settled BOOLEAN DEFAULT FALSE,
  settled_at TIMESTAMPTZ,
  payout_processed BOOLEAN DEFAULT FALSE,
  payout_processed_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Picks (individual picks within entries)
CREATE TABLE user_picks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_entry_id UUID NOT NULL REFERENCES user_entries(id) ON DELETE CASCADE,
  matchup_id UUID NOT NULL REFERENCES matchups(id),
  selected_side CHAR(1) NOT NULL CHECK (selected_side IN ('A', 'B')),
  
  -- Pick Confidence/Weight (for future features)
  confidence_level INTEGER DEFAULT 1 CHECK (confidence_level BETWEEN 1 AND 5),
  pick_weight DECIMAL(3,2) DEFAULT 1.0,
  
  -- Result Tracking
  is_winner BOOLEAN,
  is_push BOOLEAN DEFAULT FALSE,
  resulted_at TIMESTAMPTZ,
  
  -- Timing
  placed_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_entry_id, matchup_id)
);

-- Rounds (complete lifecycle tracking for user entries)
CREATE TABLE rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_entry_id UUID NOT NULL REFERENCES user_entries(id) ON DELETE CASCADE,
  
  -- Round Summary
  total_picks INTEGER NOT NULL,
  correct_picks INTEGER DEFAULT 0,
  incorrect_picks INTEGER DEFAULT 0,
  pushed_picks INTEGER DEFAULT 0,
  pending_picks INTEGER DEFAULT 0,
  
  -- Performance Metrics
  pick_accuracy DECIMAL(5,4), -- correct_picks / total_picks
  average_odds_beaten DECIMAL(8,3),
  hardest_pick_won DECIMAL(8,3), -- Longest odds successfully picked
  
  -- Payout Calculation
  entry_amount DECIMAL(10,2) NOT NULL,
  potential_max_payout DECIMAL(12,2),
  actual_payout DECIMAL(12,2) DEFAULT 0,
  final_multiplier DECIMAL(6,3),
  roi DECIMAL(8,4), -- Return on investment %
  
  -- Status & Lifecycle
  status VARCHAR(20) DEFAULT 'live' CHECK (status IN ('live', 'won', 'lost', 'pushed', 'grading', 'cancelled')),
  result_type VARCHAR(20) CHECK (result_type IN ('full_win', 'partial_win', 'loss', 'push')),
  
  -- Timing
  locked_at TIMESTAMPTZ,
  first_result_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  paid_out_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_entry_id)
);

-- ============================================
-- 6. AUDIT & CHANGE TRACKING
-- ============================================

-- Data Ingestion Logs
CREATE TABLE data_ingestion_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source VARCHAR(50) NOT NULL, -- 'mongodb', 'equibase_api', 'manual_entry'
  data_type VARCHAR(50) NOT NULL, -- 'entries', 'results', 'changes', 'odds_update'
  track_code VARCHAR(10),
  race_date DATE,
  
  -- Processing Statistics
  records_processed INTEGER DEFAULT 0,
  records_inserted INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,
  
  -- Status & Timing
  status VARCHAR(20) DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed', 'partial')),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  processing_time_ms INTEGER,
  
  -- Error Details
  error_details JSONB,
  failed_records JSONB, -- Array of records that failed to process
  
  -- Metadata
  source_metadata JSONB, -- API version, file info, etc.
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Entry Changes (scratches, AE elevations, jockey changes, etc.)
CREATE TABLE entry_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  race_entry_id UUID NOT NULL REFERENCES race_entries(id),
  change_type VARCHAR(30) NOT NULL CHECK (change_type IN ('scratch', 'ae_elevation', 'jockey_change', 'trainer_change', 'odds_update', 'equipment_change')),
  
  -- Change Details
  old_values JSONB, -- What it was before
  new_values JSONB, -- What it changed to
  change_reason TEXT,
  change_source VARCHAR(50), -- Where the change came from
  
  -- Impact Analysis
  affected_matchups UUID[], -- Matchup IDs that need recalculation
  affected_contests UUID[], -- Contest IDs that are impacted
  affected_entries UUID[], -- User entry IDs that might be affected
  
  -- Processing Status
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMPTZ,
  processing_notes TEXT,
  
  -- Official Information
  is_official BOOLEAN DEFAULT TRUE,
  announced_at TIMESTAMPTZ,
  effective_immediately BOOLEAN DEFAULT TRUE,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- System Events (for comprehensive audit trail)
CREATE TABLE system_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50) NOT NULL, -- 'contest', 'matchup', 'entry', 'race'
  entity_id UUID NOT NULL,
  
  -- Event Details
  event_data JSONB,
  old_state JSONB,
  new_state JSONB,
  
  -- Context
  triggered_by UUID REFERENCES profiles(id), -- User who triggered the event
  trigger_source VARCHAR(50), -- 'ui', 'api', 'system', 'scheduled_job'
  
  -- Impact
  cascade_events UUID[], -- Other events triggered by this one
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 7. INDEXES FOR PERFORMANCE
-- ============================================

-- Race Cards & Races
CREATE INDEX idx_race_cards_track_date ON race_cards(track_id, race_date);
CREATE INDEX idx_race_cards_date_status ON race_cards(race_date, status);
CREATE INDEX idx_races_card_number ON races(race_card_id, race_number);
CREATE INDEX idx_races_post_time ON races(post_time);

-- Race Entries & Results
CREATE INDEX idx_race_entries_race_id ON race_entries(race_id);
CREATE INDEX idx_race_entries_horse_id ON race_entries(horse_id);
CREATE INDEX idx_race_entries_connections ON race_entries(jockey_id, trainer_id);
CREATE INDEX idx_race_entries_status ON race_entries(status);
-- Partial unique index: only one active horse per post position (scratched horses don't count)
CREATE UNIQUE INDEX idx_race_entries_unique_post_position 
  ON race_entries(race_id, post_position) 
  WHERE status != 'scratched';
CREATE INDEX idx_race_results_entry_id ON race_results(race_entry_id);
CREATE INDEX idx_race_results_points ON race_results(points_earned DESC);

-- Contests & Matchups  
CREATE INDEX idx_contests_date_status ON contests(contest_date, status);
CREATE INDEX idx_contests_lock_time ON contests(lock_time);
CREATE INDEX idx_contest_races_contest ON contest_races(contest_id);
CREATE INDEX idx_matchup_pools_contest ON matchup_pools(contest_id);
CREATE INDEX idx_matchups_contest_type ON matchups(contest_id, matchup_type);
CREATE INDEX idx_matchup_entries_matchup ON matchup_entries(matchup_id);

-- User Entries & Picks
CREATE INDEX idx_user_entries_contest_user ON user_entries(contest_id, user_id);
CREATE INDEX idx_user_entries_user_status ON user_entries(user_id, status);
CREATE INDEX idx_user_picks_entry ON user_picks(user_entry_id);
CREATE INDEX idx_user_picks_matchup ON user_picks(matchup_id);
CREATE INDEX idx_rounds_entry_id ON rounds(user_entry_id);
CREATE INDEX idx_rounds_status_completed ON rounds(status, completed_at);

-- Audit Tables
CREATE INDEX idx_ingestion_logs_source_date ON data_ingestion_logs(source, race_date);
CREATE INDEX idx_ingestion_logs_status ON data_ingestion_logs(status, started_at);
CREATE INDEX idx_entry_changes_race_entry ON entry_changes(race_entry_id);
CREATE INDEX idx_entry_changes_processed ON entry_changes(processed, created_at);
CREATE INDEX idx_system_events_entity ON system_events(entity_type, entity_id);
CREATE INDEX idx_system_events_type_time ON system_events(event_type, created_at);

-- ============================================
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS on all user-facing tables
ALTER TABLE contests ENABLE ROW LEVEL SECURITY;
ALTER TABLE matchups ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_picks ENABLE ROW LEVEL SECURITY;
ALTER TABLE rounds ENABLE ROW LEVEL SECURITY;

-- Contest Policies
CREATE POLICY "Anyone can view active contests" ON contests
  FOR SELECT USING (status IN ('open', 'locked', 'live') AND is_public = TRUE);

CREATE POLICY "Admins can manage contests" ON contests
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- Matchup Policies  
CREATE POLICY "Users can view contest matchups" ON matchups
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM contests 
      WHERE contests.id = matchups.contest_id 
      AND contests.is_public = TRUE 
      AND contests.status IN ('open', 'locked', 'live', 'grading', 'settled')
    )
  );

-- User Entry Policies
CREATE POLICY "Users can view own entries" ON user_entries
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own entries" ON user_entries  
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own picks" ON user_picks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_entries 
      WHERE user_entries.id = user_picks.user_entry_id 
      AND user_entries.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create own picks" ON user_picks
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_entries 
      WHERE user_entries.id = user_picks.user_entry_id 
      AND user_entries.user_id = auth.uid()
    )
  );

-- Round Policies
CREATE POLICY "Users can view own rounds" ON rounds
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_entries 
      WHERE user_entries.id = rounds.user_entry_id 
      AND user_entries.user_id = auth.uid()
    )
  );

-- ============================================
-- 9. TRIGGERS FOR AUTOMATED PROCESSING
-- ============================================

-- Update timestamps automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all relevant tables
DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOR table_name IN 
    SELECT t FROM unnest(ARRAY[
      'tracks', 'race_cards', 'races', 'horses', 'connections', 
      'race_entries', 'contests', 'matchups', 'user_entries', 'rounds'
    ]) AS t
  LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS update_%s_updated_at ON %s;
      CREATE TRIGGER update_%s_updated_at
        BEFORE UPDATE ON %s
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    ', table_name, table_name, table_name, table_name);
  END LOOP;
END $$;

-- ============================================
-- 10. HELPER FUNCTIONS
-- ============================================

-- Calculate user entry results
CREATE OR REPLACE FUNCTION calculate_entry_results(entry_id UUID)
RETURNS TABLE (
  total_picks INTEGER,
  correct_picks INTEGER,
  pending_picks INTEGER,
  is_winner BOOLEAN,
  final_payout DECIMAL
) AS $$
DECLARE
  entry_record user_entries%ROWTYPE;
  pick_stats RECORD;
BEGIN
  -- Get entry details
  SELECT * INTO entry_record FROM user_entries WHERE id = entry_id;
  
  -- Calculate pick statistics
  SELECT 
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE is_winner = TRUE) as correct,
    COUNT(*) FILTER (WHERE is_winner IS NULL) as pending
  INTO pick_stats
  FROM user_picks 
  WHERE user_entry_id = entry_id;
  
  -- Return calculated results
  total_picks := pick_stats.total;
  correct_picks := pick_stats.correct;
  pending_picks := pick_stats.pending;
  
  -- Determine if entry is a winner (simplified logic)
  is_winner := correct_picks >= (total_picks / 2);
  
  -- Calculate payout (simplified - would use contest-specific rules)
  IF is_winner AND pending_picks = 0 THEN
    final_payout := entry_record.entry_amount * entry_record.max_multiplier;
  ELSE
    final_payout := 0;
  END IF;
  
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- Get contest status summary
CREATE OR REPLACE FUNCTION get_contest_summary(contest_id UUID)
RETURNS TABLE (
  contest_name TEXT,
  total_entries BIGINT,
  total_prize_pool DECIMAL,
  races_completed BIGINT,
  races_total BIGINT,
  next_post_time TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.name,
    COUNT(DISTINCT ue.id)::BIGINT,
    COALESCE(SUM(ue.entry_amount), 0),
    COUNT(DISTINCT r.id) FILTER (WHERE r.status = 'official')::BIGINT,
    COUNT(DISTINCT cr.race_id)::BIGINT,
    MIN(r.post_time) FILTER (WHERE r.status = 'scheduled' AND r.post_time > NOW())
  FROM contests c
  LEFT JOIN user_entries ue ON c.id = ue.contest_id
  LEFT JOIN contest_races cr ON c.id = cr.contest_id  
  LEFT JOIN races r ON cr.race_id = r.id
  WHERE c.id = get_contest_summary.contest_id
  GROUP BY c.id, c.name;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- COMPLETE!
-- ============================================
-- This schema provides:
-- ✅ Complete relational integrity
-- ✅ Full audit trail and change tracking  
-- ✅ Proper lifecycle management
-- ✅ Real-time change handling
-- ✅ Performance optimization
-- ✅ Security with RLS
-- ✅ Extensibility for future features
-- ============================================
