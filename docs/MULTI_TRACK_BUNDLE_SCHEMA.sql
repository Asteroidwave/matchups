-- Multi-track bundle storage (run in Supabase SQL editor)
CREATE TABLE IF NOT EXISTS multi_track_bundles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contest_ids UUID[] NOT NULL,
  track_codes TEXT[] NOT NULL,
  matchup_types TEXT[] NOT NULL,
  matchup_data JSONB NOT NULL,
  status TEXT DEFAULT 'ready',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_multi_track_bundles_status
  ON multi_track_bundles(status);

CREATE POLICY "Admins manage multi-track bundles"
  ON multi_track_bundles FOR ALL
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

