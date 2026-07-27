-- supabase/migrations/20260726000000_init_schema.sql

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Sport Profiles
CREATE TABLE public.sport_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sport_type TEXT UNIQUE NOT NULL,
    event_type_config_jsonb JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS for sport_profiles
ALTER TABLE public.sport_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access to sport_profiles" ON public.sport_profiles FOR SELECT USING (true);
CREATE POLICY "Allow auth admin modification of sport_profiles" ON public.sport_profiles FOR ALL TO authenticated USING (true);

-- 2. Tournaments
CREATE TABLE public.tournaments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organizer_id UUID,
    name TEXT NOT NULL,
    logo_url TEXT,
    sport_type TEXT NOT NULL REFERENCES public.sport_profiles(sport_type) ON UPDATE CASCADE,
    format TEXT NOT NULL, -- 'league', 'knockout', 'hybrid'
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft', -- 'draft', 'active', 'completed'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access to tournaments" ON public.tournaments FOR SELECT USING (true);
CREATE POLICY "Allow organizers to manage their tournaments" ON public.tournaments FOR ALL TO authenticated USING (true);

-- 3. Teams
CREATE TABLE public.teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    logo_url TEXT,
    color_hex TEXT NOT NULL DEFAULT '#FACC15',
    captain_id UUID, -- Will resolve cyclic FK in application or set as nullable
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access to teams" ON public.teams FOR SELECT USING (true);
CREATE POLICY "Allow organizers to manage teams" ON public.teams FOR ALL TO authenticated USING (true);

-- 4. Players
CREATE TABLE public.players (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    photo_url TEXT,
    role TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Resolve captain_id relation back to players
ALTER TABLE public.teams ADD CONSTRAINT fk_teams_captain FOREIGN KEY (captain_id) REFERENCES public.players(id) ON DELETE SET NULL;

ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access to players" ON public.players FOR SELECT USING (true);
CREATE POLICY "Allow organizers to manage players" ON public.players FOR ALL TO authenticated USING (true);

-- 5. Matches
CREATE TABLE public.matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
    round_name TEXT NOT NULL, -- e.g., 'Round 1', 'Semifinal', 'Final'
    team_a_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    team_b_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'scheduled', -- 'scheduled', 'in_progress', 'completed'
    scheduled_at TIMESTAMPTZ NOT NULL,
    metadata_jsonb JSONB DEFAULT '{}'::jsonb, -- For shootouts, extra time flags, etc.
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access to matches" ON public.matches FOR SELECT USING (true);
CREATE POLICY "Allow organizers to manage matches" ON public.matches FOR ALL TO authenticated USING (true);

-- 6. Match Events
CREATE TABLE public.match_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
    player_id UUID REFERENCES public.players(id) ON DELETE CASCADE,
    team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE, -- Captures team-level actions or acts as shortcut
    event_type TEXT NOT NULL, -- 'goal', 'own_goal', 'yellow_card', 'red_card', 'possession', etc.
    minute INTEGER CHECK (minute >= 0),
    metadata_jsonb JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.match_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access to match_events" ON public.match_events FOR SELECT USING (true);
CREATE POLICY "Allow organizers to manage match_events" ON public.match_events FOR ALL TO authenticated USING (true);

-- 7. Awards
CREATE TABLE public.awards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
    award_type TEXT NOT NULL, -- 'champion', 'runner_up', 'golden_boot', etc.
    recipient_id UUID NOT NULL, -- references team_id or player_id depending on type
    auto_generated BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.awards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access to awards" ON public.awards FOR SELECT USING (true);
CREATE POLICY "Allow organizers to manage awards" ON public.awards FOR ALL TO authenticated USING (true);

-- 8. Tournament Templates
CREATE TABLE public.tournament_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organizer_id UUID,
    name TEXT NOT NULL,
    sport_type TEXT NOT NULL REFERENCES public.sport_profiles(sport_type) ON UPDATE CASCADE,
    format TEXT NOT NULL,
    config_jsonb JSONB NOT NULL, -- Stores playoff configurations, rules, etc.
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.tournament_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access to tournament_templates" ON public.tournament_templates FOR SELECT USING (true);
CREATE POLICY "Allow organizers to manage their templates" ON public.tournament_templates FOR ALL TO authenticated USING (true);


--- VIEWS AND DERIVED SCHEMAS ---

-- View: match_goals_computed
-- Dynamically counts goals for team_a and team_b in each match from match_events.
-- For a match:
--   Team A's goals = count of goals by Team A + own goals by Team B
--   Team B's goals = count of goals by Team B + own goals by Team A
CREATE OR REPLACE VIEW public.match_goals_computed AS
WITH goal_events AS (
    SELECT 
        me.match_id,
        me.team_id AS event_team_id,
        me.event_type
    FROM public.match_events me
    WHERE me.event_type IN ('goal', 'own_goal')
),
match_teams AS (
    SELECT 
        m.id AS match_id,
        m.team_a_id,
        m.team_b_id
    FROM public.matches m
),
goals_calculated AS (
    SELECT
        mt.match_id,
        COALESCE(SUM(CASE 
            WHEN (ge.event_team_id = mt.team_a_id AND ge.event_type = 'goal') OR 
                 (ge.event_team_id = mt.team_b_id AND ge.event_type = 'own_goal') THEN 1 
            ELSE 0 
        END), 0) AS team_a_goals,
        COALESCE(SUM(CASE 
            WHEN (ge.event_team_id = mt.team_b_id AND ge.event_type = 'goal') OR 
                 (ge.event_team_id = mt.team_a_id AND ge.event_type = 'own_goal') THEN 1 
            ELSE 0 
        END), 0) AS team_b_goals
    FROM match_teams mt
    LEFT JOIN goal_events ge ON ge.match_id = mt.match_id
    GROUP BY mt.match_id
)
SELECT 
    m.id AS match_id,
    m.tournament_id,
    m.status,
    m.team_a_id,
    m.team_b_id,
    COALESCE(gc.team_a_goals, 0) AS team_a_score,
    COALESCE(gc.team_b_goals, 0) AS team_b_score
FROM public.matches m
LEFT JOIN goals_calculated gc ON gc.match_id = m.id;


-- View: standings_computed
-- Dynamically calculates league standings from completed matches.
CREATE OR REPLACE VIEW public.standings_computed AS
WITH match_results AS (
    SELECT 
        mg.tournament_id,
        mg.match_id,
        mg.team_a_id AS team_id,
        1 AS matches_played,
        CASE WHEN mg.team_a_score > mg.team_b_score THEN 1 ELSE 0 END AS win,
        CASE WHEN mg.team_a_score = mg.team_b_score THEN 1 ELSE 0 END AS draw,
        CASE WHEN mg.team_a_score < mg.team_b_score THEN 1 ELSE 0 END AS loss,
        mg.team_a_score AS goals_for,
        mg.team_b_score AS goals_against
    FROM public.match_goals_computed mg
    WHERE mg.status = 'completed'
    
    UNION ALL
    
    SELECT 
        mg.tournament_id,
        mg.match_id,
        mg.team_b_id AS team_id,
        1 AS matches_played,
        CASE WHEN mg.team_b_score > mg.team_a_score THEN 1 ELSE 0 END AS win,
        CASE WHEN mg.team_b_score = mg.team_a_score THEN 1 ELSE 0 END AS draw,
        CASE WHEN mg.team_b_score < mg.team_a_score THEN 1 ELSE 0 END AS loss,
        mg.team_b_score AS goals_for,
        mg.team_a_score AS goals_against
    FROM public.match_goals_computed mg
    WHERE mg.status = 'completed'
),
aggregated AS (
    SELECT 
        t.tournament_id,
        t.id AS team_id,
        t.name AS team_name,
        t.logo_url,
        t.color_hex,
        COALESCE(SUM(mr.matches_played), 0) AS mp,
        COALESCE(SUM(mr.win), 0) AS w,
        COALESCE(SUM(mr.draw), 0) AS d,
        COALESCE(SUM(mr.loss), 0) AS l,
        COALESCE(SUM(mr.goals_for), 0) AS gf,
        COALESCE(SUM(mr.goals_against), 0) AS ga,
        COALESCE(SUM(mr.goals_for) - SUM(mr.goals_against), 0) AS gd,
        COALESCE(SUM(mr.win) * 3 + SUM(mr.draw) * 1, 0) AS pts
    FROM public.teams t
    LEFT JOIN match_results mr ON mr.team_id = t.id
    GROUP BY t.tournament_id, t.id, t.name, t.logo_url, t.color_hex
)
SELECT 
    *,
    ROW_NUMBER() OVER (
        PARTITION BY tournament_id 
        ORDER BY pts DESC, gd DESC, gf DESC, team_name ASC
    ) AS rank
FROM aggregated;


-- 9. Seed Football Profile
INSERT INTO public.sport_profiles (sport_type, event_type_config_jsonb)
VALUES (
    'football',
    '{
        "display_name": "Football",
        "events": {
            "goal": {
                "label": "Goal",
                "requires_player": true,
                "has_assister": true,
                "affects_score": true
            },
            "own_goal": {
                "label": "Own Goal",
                "requires_player": true,
                "has_assister": false,
                "affects_score": true
            },
            "yellow_card": {
                "label": "Yellow Card",
                "requires_player": true,
                "has_assister": false,
                "affects_score": false
            },
            "red_card": {
                "label": "Red Card",
                "requires_player": true,
                "has_assister": false,
                "affects_score": false
            },
            "possession": {
                "label": "Possession %",
                "requires_player": false,
                "has_assister": false,
                "affects_score": false,
                "value_type": "percentage"
            },
            "shots": {
                "label": "Shots on Target",
                "requires_player": false,
                "has_assister": false,
                "affects_score": false,
                "value_type": "integer"
            },
            "clean_sheet": {
                "label": "Clean Sheet",
                "requires_player": true,
                "has_assister": false,
                "affects_score": false
            },
            "mvp": {
                "label": "Man of the Match",
                "requires_player": true,
                "has_assister": false,
                "affects_score": false
            }
        },
        "standings_columns": ["MP", "W", "D", "L", "GF", "GA", "GD", "PTS"],
        "scoring_events": ["goal", "own_goal"]
    }'::jsonb
) ON CONFLICT (sport_type) DO UPDATE
SET event_type_config_jsonb = EXCLUDED.event_type_config_jsonb;
