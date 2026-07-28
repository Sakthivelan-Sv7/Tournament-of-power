-- supabase/migrations/20260729000000_ensure_team_status.sql
--
-- This migration ensures the 'status' column exists on the teams table.
-- It is idempotent (safe to run multiple times) due to the IF NOT EXISTS guard.
-- If the column already exists from a prior migration, this is a no-op.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'teams'
      AND column_name = 'status'
  ) THEN
    ALTER TABLE public.teams
      ADD COLUMN status TEXT NOT NULL DEFAULT 'pending'
      CHECK (status IN ('pending', 'accepted', 'rejected'));
  END IF;
END;
$$;

-- Ensure existing teams that have no status value are set to 'pending'
-- (handles any rows inserted before the column existed)
UPDATE public.teams SET status = 'pending' WHERE status IS NULL OR status = '';
