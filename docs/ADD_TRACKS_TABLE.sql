-- ============================================
-- ADD TRACKS MANAGEMENT TABLE
-- ============================================
-- Run this AFTER running FRESH_SUPABASE_SETUP.sql
-- This adds a tracks table for managing track visibility
-- ============================================

-- Create tracks table
CREATE TABLE tracks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  track_code TEXT NOT NULL UNIQUE,
  track_name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE tracks ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES FOR TRACKS
-- ============================================

-- Policy: Everyone can view active tracks
CREATE POLICY "Anyone can view active tracks"
  ON tracks FOR SELECT
  USING (is_active = TRUE);

-- Policy: Admins can view all tracks
CREATE POLICY "Admins can view all tracks"
  ON tracks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND is_admin = TRUE
    )
  );

-- Policy: Only admins can insert tracks
CREATE POLICY "Admins can create tracks"
  ON tracks FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND is_admin = TRUE
    )
  );

-- Policy: Only admins can update tracks
CREATE POLICY "Admins can update tracks"
  ON tracks FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND is_admin = TRUE
    )
  );

-- Policy: Only admins can delete tracks
CREATE POLICY "Admins can delete tracks"
  ON tracks FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND is_admin = TRUE
    )
  );

-- ============================================
-- CREATE TRIGGER TO UPDATE updated_at
-- ============================================
CREATE TRIGGER update_tracks_updated_at
  BEFORE UPDATE ON tracks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- SEED INITIAL TRACKS
-- ============================================
INSERT INTO tracks (track_code, track_name, is_active) VALUES
  ('BAQ', 'Belmont Park', TRUE),
  ('CD', 'Churchill Downs', TRUE),
  ('DMR', 'Del Mar', TRUE),
  ('GP', 'Gulfstream Park', TRUE),
  ('LRL', 'Laurel Park', TRUE),
  ('MNR', 'Mountaineer Park', TRUE)
ON CONFLICT (track_code) DO UPDATE SET
  track_name = EXCLUDED.track_name,
  is_active = EXCLUDED.is_active;

-- ============================================
-- VERIFY
-- ============================================
SELECT * FROM tracks ORDER BY track_code;

