-- Create entries table for contest submissions
CREATE TABLE IF NOT EXISTS entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id UUID NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  picks JSONB NOT NULL, -- Array of { matchupId, side: 'A' | 'B' }
  entry_amount DECIMAL(10, 2) NOT NULL,
  multiplier INTEGER NOT NULL DEFAULT 2,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, live, won, lost, cancelled
  payout_amount DECIMAL(10, 2) DEFAULT 0,
  matched_results INTEGER DEFAULT 0, -- Count of matchups with results
  winning_picks INTEGER DEFAULT 0, -- Count of winning picks
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  settled_at TIMESTAMP WITH TIME ZONE,
  
  -- Constraints
  CONSTRAINT entry_amount_positive CHECK (entry_amount > 0),
  CONSTRAINT multiplier_valid CHECK (multiplier >= 2),
  CONSTRAINT status_valid CHECK (status IN ('pending', 'live', 'won', 'lost', 'cancelled'))
);

-- Create indexes for performance
CREATE INDEX idx_entries_contest_id ON entries(contest_id);
CREATE INDEX idx_entries_user_id ON entries(user_id);
CREATE INDEX idx_entries_status ON entries(status);
CREATE INDEX idx_entries_created_at ON entries(created_at DESC);
CREATE INDEX idx_entries_contest_user ON entries(contest_id, user_id);

-- Add RLS policies
ALTER TABLE entries ENABLE ROW LEVEL SECURITY;

-- Users can view their own entries
CREATE POLICY "Users can view own entries" ON entries
  FOR SELECT USING (auth.uid() = user_id);

-- Users can create their own entries
CREATE POLICY "Users can create own entries" ON entries
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Only system can update entries (for settling)
CREATE POLICY "System can update entries" ON entries
  FOR UPDATE USING (false);

-- Grant permissions
GRANT SELECT, INSERT ON entries TO authenticated;
GRANT ALL ON entries TO service_role;
