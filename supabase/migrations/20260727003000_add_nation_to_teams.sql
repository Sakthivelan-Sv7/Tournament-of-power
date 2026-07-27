-- Add missing nation column to teams table
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS nation TEXT;
