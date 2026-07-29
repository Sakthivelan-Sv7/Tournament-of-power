-- supabase/migrations/20260729001000_rls_team_insert_policy.sql
--
-- Problem: "Allow admins to manage teams" uses FOR ALL with only a USING clause.
-- In Postgres RLS, FOR ALL with only USING applies that check as the WITH CHECK
-- for INSERT as well — meaning regular (non-admin) users cannot insert any row.
--
-- Fix: Add an explicit FOR INSERT policy that lets any authenticated user
-- register a new team as long as status = 'pending'.

CREATE POLICY "Allow users to register a team"
  ON public.teams
  FOR INSERT
  TO authenticated
  WITH CHECK (status = 'pending');

-- Note: The players table already has a correct INSERT policy:
--   "Allow users to register themselves" FOR INSERT WITH CHECK (user_id = auth.uid())
-- No change needed there.
