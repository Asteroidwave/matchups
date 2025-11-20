-- ============================================
-- FIX SECURITY WARNINGS: Function Search Path
-- ============================================
-- This script fixes the "function search_path mutable" warnings
-- by setting explicit search_path for all functions
-- Run this in Supabase SQL Editor
-- ============================================

-- Fix 1: update_updated_at_column
-- This function doesn't need SECURITY DEFINER, but we'll set search_path anyway
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Fix 2: is_user_admin
CREATE OR REPLACE FUNCTION public.is_user_admin(user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = user_id AND is_admin = TRUE
  );
END;
$$;

-- Fix 3: handle_new_user (trigger function)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, is_admin, bankroll)
  VALUES (
    NEW.id,
    NEW.email,
    FALSE, -- Default to not admin
    1000.00 -- Default bankroll
  );
  RETURN NEW;
END;
$$;

-- Fix 4: get_contest_status_summary
CREATE OR REPLACE FUNCTION public.get_contest_status_summary(contest_uuid UUID)
RETURNS TABLE (
  status TEXT,
  matchup_types TEXT[],
  matchups_count BIGINT,
  matchups_calculated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

-- ============================================
-- VERIFICATION
-- ============================================
-- After running, check that warnings are gone:
-- SELECT * FROM supabase_lint.lints WHERE name = 'function_search_path_mutable';

-- ============================================
-- COMPLETE!
-- ============================================
-- All functions now have explicit search_path set
-- This prevents search_path injection attacks
-- Security warnings should be resolved

