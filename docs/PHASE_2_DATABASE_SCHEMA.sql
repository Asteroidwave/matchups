-- ============================================
-- PHASE 2: NEW CONTEST FLOW - DATABASE SCHEMA
-- ============================================
-- This script adds tables and columns needed for the new contest creation flow
-- Run this in Supabase SQL Editor
-- Safe to run - won't delete existing data
-- ============================================

-- ============================================
-- STEP 1: CREATE TRACK_DATA TABLE
-- ============================================
-- Stores MongoDB data and metadata for each track/date combination
CREATE TABLE IF NOT EXISTS track_data (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  track_code TEXT NOT NULL,
  date DATE NOT NULL,
  data JSONB NOT NULL, -- Full MongoDB data (entries + results)
  metadata JSONB, -- { races_count, horses_count, post_times: [], first_post_time, last_post_time }
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(track_code, date)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_track_data_track_date ON track_data(track_code, date);
CREATE INDEX IF NOT EXISTS idx_track_data_fetched_at ON track_data(fetched_at DESC);

-- Enable Row Level Security
ALTER TABLE track_data ENABLE ROW LEVEL SECURITY;

-- RLS Policies for track_data
-- Admins can do everything, users can view
CREATE POLICY "Admins can manage track_data"
  ON track_data FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );

-- Users can view track_data (for previews)
CREATE POLICY "Users can view track_data"
  ON track_data FOR SELECT
  USING (true); -- Public read access for track data

-- ============================================
-- STEP 2: CREATE MATCHUPS TABLE
-- ============================================
-- Stores calculated matchups for each contest
CREATE TABLE IF NOT EXISTS matchups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contest_id UUID NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
  matchup_type TEXT NOT NULL, -- 'jockey_vs_jockey', 'trainer_vs_trainer', 'sire_vs_sire', 'mixed'
  matchup_data JSONB NOT NULL, -- Full matchup data (connections, sets, etc.)
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(contest_id, matchup_type)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_matchups_contest_id ON matchups(contest_id);
CREATE INDEX IF NOT EXISTS idx_matchups_contest_type ON matchups(contest_id, matchup_type);
CREATE INDEX IF NOT EXISTS idx_matchups_calculated_at ON matchups(calculated_at DESC);

-- Enable Row Level Security
ALTER TABLE matchups ENABLE ROW LEVEL SECURITY;

-- RLS Policies for matchups
-- Admins can manage, users can view
CREATE POLICY "Admins can manage matchups"
  ON matchups FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );

-- Users can view matchups for active contests
CREATE POLICY "Users can view matchups for active contests"
  ON matchups FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM contests
      WHERE contests.id = matchups.contest_id
      AND contests.is_active = TRUE
    )
  );

-- ============================================
-- STEP 3: CREATE OPERATIONS TABLE
-- ============================================
-- Tracks async operations (fetching data, calculating matchups, etc.)
CREATE TABLE IF NOT EXISTS operations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  operation_type TEXT NOT NULL, -- 'fetch_track_data', 'calculate_matchups', etc.
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  progress INTEGER DEFAULT 0, -- 0-100
  input_data JSONB, -- Input parameters (track, date, etc.)
  result_data JSONB, -- Result data (track_data_id, matchup_count, etc.)
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_operations_user_id ON operations(user_id);
CREATE INDEX IF NOT EXISTS idx_operations_status ON operations(status);
CREATE INDEX IF NOT EXISTS idx_operations_type ON operations(operation_type);
CREATE INDEX IF NOT EXISTS idx_operations_created_at ON operations(created_at DESC);

-- Enable Row Level Security
ALTER TABLE operations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for operations
-- Users can only see their own operations, admins can see all
CREATE POLICY "Users can view own operations"
  ON operations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own operations"
  ON operations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own operations"
  ON operations FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admins can view all operations
CREATE POLICY "Admins can view all operations"
  ON operations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );

-- ============================================
-- STEP 4: UPDATE CONTESTS TABLE
-- ============================================
-- Add new columns for the enhanced contest flow

-- Add status column (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'contests' AND column_name = 'status'
  ) THEN
    ALTER TABLE contests ADD COLUMN status TEXT DEFAULT 'draft';
    -- Update existing contests to 'ready' status (they were created before this system)
    UPDATE contests SET status = 'ready' WHERE status IS NULL;
  END IF;
END $$;

-- Add track_data_id column (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'contests' AND column_name = 'track_data_id'
  ) THEN
    ALTER TABLE contests ADD COLUMN track_data_id UUID REFERENCES track_data(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add matchup_types column (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'contests' AND column_name = 'matchup_types'
  ) THEN
    ALTER TABLE contests ADD COLUMN matchup_types TEXT[] DEFAULT ARRAY[]::TEXT[];
  END IF;
END $$;

-- Add matchups_calculated_at column (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'contests' AND column_name = 'matchups_calculated_at'
  ) THEN
    ALTER TABLE contests ADD COLUMN matchups_calculated_at TIMESTAMPTZ;
  END IF;
END $$;

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_contests_status ON contests(status);
CREATE INDEX IF NOT EXISTS idx_contests_track_data_id ON contests(track_data_id);
CREATE INDEX IF NOT EXISTS idx_contests_matchups_calculated_at ON contests(matchups_calculated_at DESC);

-- Add check constraint for status values
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'contests_status_check'
  ) THEN
    ALTER TABLE contests ADD CONSTRAINT contests_status_check 
      CHECK (status IN ('draft', 'processing', 'ready', 'active'));
  END IF;
END $$;

-- ============================================
-- STEP 5: CREATE TRIGGER FOR UPDATED_AT
-- ============================================
-- Auto-update updated_at timestamp on row changes

-- Function to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for each table
DROP TRIGGER IF EXISTS update_track_data_updated_at ON track_data;
CREATE TRIGGER update_track_data_updated_at
  BEFORE UPDATE ON track_data
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_matchups_updated_at ON matchups;
CREATE TRIGGER update_matchups_updated_at
  BEFORE UPDATE ON matchups
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_operations_updated_at ON operations;
CREATE TRIGGER update_operations_updated_at
  BEFORE UPDATE ON operations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- STEP 6: CREATE HELPER FUNCTIONS
-- ============================================

-- Function to get contest status summary
CREATE OR REPLACE FUNCTION get_contest_status_summary(contest_uuid UUID)
RETURNS TABLE (
  status TEXT,
  matchup_types TEXT[],
  matchups_count BIGINT,
  matchups_calculated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.status,
    c.matchup_types,
    COUNT(m.id)::BIGINT as matchups_count,
    c.matchups_calculated_at
  FROM contests c
  LEFT JOIN matchups m ON c.id = m.contest_id
  WHERE c.id = contest_uuid
  GROUP BY c.id, c.status, c.matchup_types, c.matchups_calculated_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- STEP 7: VERIFICATION QUERIES
-- ============================================
-- Run these to verify everything was created correctly

-- Verify tables exist
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_schema = 'public' 
-- AND table_name IN ('track_data', 'matchups', 'operations')
-- ORDER BY table_name;

-- Verify contests table has new columns
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'contests'
-- AND column_name IN ('status', 'track_data_id', 'matchup_types', 'matchups_calculated_at')
-- ORDER BY column_name;

-- ============================================
-- COMPLETE!
-- ============================================
-- All tables and columns have been created
-- RLS policies are in place
-- Indexes are created for performance
-- Ready for Phase 3: Backend APIs

