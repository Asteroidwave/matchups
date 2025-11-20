-- Fix horse sex constraint to match MongoDB data format
-- Run this in Supabase SQL Editor

-- Remove the restrictive sex constraint  
ALTER TABLE horses DROP CONSTRAINT IF EXISTS horses_sex_check;

-- Add flexible constraint for sex values
ALTER TABLE horses ADD CONSTRAINT horses_sex_flexible_check 
  CHECK (sex IS NULL OR LENGTH(sex) <= 20);

-- Show current horse count (should increase after ingestion)
SELECT COUNT(*) as current_horse_count FROM horses;
