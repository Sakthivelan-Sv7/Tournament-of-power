-- supabase/migrations/20260727001000_player_pool.sql

-- 1. Add tournament_id to players table
ALTER TABLE public.players ADD COLUMN tournament_id UUID REFERENCES public.tournaments(id) ON DELETE CASCADE;

-- 2. Make team_id nullable
ALTER TABLE public.players ALTER COLUMN team_id DROP NOT NULL;

-- 3. Backfill tournament_id for existing players based on their team's tournament_id
UPDATE public.players p
SET tournament_id = t.tournament_id
FROM public.teams t
WHERE p.team_id = t.id;

-- 4. Update the trigger/RLS policy for inserting players
DROP POLICY IF EXISTS "Allow users to register themselves" ON public.players;
CREATE POLICY "Allow users to register themselves to pool" ON public.players FOR INSERT TO authenticated WITH CHECK (
    user_id = auth.uid() AND tournament_id IS NOT NULL
);

-- 5. Allow admins to update player team assignments
-- (Covered by "Allow admins to manage players" policy which gives ALL permissions to admin)
