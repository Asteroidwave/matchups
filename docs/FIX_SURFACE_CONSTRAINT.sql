-- Fix surface constraint that's blocking race insertions
-- Run this in Supabase SQL Editor

-- Remove the overly restrictive surface constraint
ALTER TABLE races DROP CONSTRAINT IF EXISTS races_surface_check;

-- Add a more flexible constraint that allows common racing surface values
ALTER TABLE races ADD CONSTRAINT races_surface_flexible_check 
  CHECK (surface IS NULL OR LENGTH(surface) <= 50);

-- Show current race count (should increase after this fix)
SELECT COUNT(*) as current_race_count FROM races;
