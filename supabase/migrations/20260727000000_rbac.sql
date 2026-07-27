-- supabase/migrations/20260727000000_rbac.sql

-- 1. Profiles Table
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access to profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Allow users to read their own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Allow users to update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
-- Allow inserting profile via trigger or directly for now
CREATE POLICY "Allow users to insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- 2. Add user_id to players
ALTER TABLE public.players ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 3. Update RLS for Tournaments
DROP POLICY IF EXISTS "Allow organizers to manage their tournaments" ON public.tournaments;
CREATE POLICY "Allow admins to manage tournaments" ON public.tournaments FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 4. Update RLS for Teams
DROP POLICY IF EXISTS "Allow organizers to manage teams" ON public.teams;
CREATE POLICY "Allow admins to manage teams" ON public.teams FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 5. Update RLS for Players
DROP POLICY IF EXISTS "Allow organizers to manage players" ON public.players;
CREATE POLICY "Allow admins to manage players" ON public.players FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
-- Allow users to insert themselves as a player
CREATE POLICY "Allow users to register themselves" ON public.players FOR INSERT TO authenticated WITH CHECK (
    user_id = auth.uid()
);

-- 6. Update RLS for Matches
DROP POLICY IF EXISTS "Allow organizers to manage matches" ON public.matches;
CREATE POLICY "Allow admins to manage matches" ON public.matches FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 7. Update RLS for Match Events
DROP POLICY IF EXISTS "Allow organizers to manage match_events" ON public.match_events;
CREATE POLICY "Allow admins to manage match_events" ON public.match_events FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 8. Update RLS for Awards
DROP POLICY IF EXISTS "Allow organizers to manage awards" ON public.awards;
CREATE POLICY "Allow admins to manage awards" ON public.awards FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 9. Update RLS for Tournament Templates
DROP POLICY IF EXISTS "Allow organizers to manage their templates" ON public.tournament_templates;
CREATE POLICY "Allow admins to manage templates" ON public.tournament_templates FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
