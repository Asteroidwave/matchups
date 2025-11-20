-- Migration: Add simulation tables
-- Date: 2025-11-12
-- Purpose: Support simulated live races for testing

-- Create simulations table
CREATE TABLE IF NOT EXISTS simulations (
  id TEXT PRIMARY KEY,
  contest_id UUID REFERENCES contests(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL DEFAULT 'ready', -- ready, running, paused, finished
  speed_multiplier INTEGER NOT NULL DEFAULT 1,
  current_race_index INTEGER DEFAULT 0,
  simulation_data JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  started_at TIMESTAMP,
  paused_at TIMESTAMP,
  finished_at TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_simulations_contest ON simulations(contest_id);
CREATE INDEX IF NOT EXISTS idx_simulations_status ON simulations(status);
CREATE INDEX IF NOT EXISTS idx_simulations_created ON simulations(created_at DESC);

-- Create simulation_events table for replay/debugging
CREATE TABLE IF NOT EXISTS simulation_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  simulation_id TEXT REFERENCES simulations(id) ON DELETE CASCADE NOT NULL,
  event_type TEXT NOT NULL,
  event_data JSONB NOT NULL,
  simulated_time TIMESTAMP NOT NULL,
  actual_time TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_simulation_events_sim ON simulation_events(simulation_id);
CREATE INDEX IF NOT EXISTS idx_simulation_events_time ON simulation_events(simulated_time);
CREATE INDEX IF NOT EXISTS idx_simulation_events_type ON simulation_events(event_type);

-- Add RLS policies
ALTER TABLE simulations ENABLE ROW LEVEL SECURITY;
ALTER TABLE simulation_events ENABLE ROW LEVEL SECURITY;

-- Admin can do everything
CREATE POLICY "Admins can manage simulations"
  ON simulations
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Users can view simulations for contests they have entries in
CREATE POLICY "Users can view their simulation data"
  ON simulations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM entries
      WHERE entries.contest_id = simulations.contest_id
      AND entries.user_id = auth.uid()
    )
  );

-- Similar for simulation events
CREATE POLICY "Admins can manage simulation events"
  ON simulation_events
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

CREATE POLICY "Users can view their simulation events"
  ON simulation_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM entries
      JOIN simulations ON simulations.contest_id = entries.contest_id
      WHERE simulation_events.simulation_id = simulations.id
      AND entries.user_id = auth.uid()
    )
  );

