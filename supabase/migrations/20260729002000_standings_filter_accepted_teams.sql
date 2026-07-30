-- supabase/migrations/20260729002000_standings_filter_accepted_teams.sql
--
-- Bug: The standings_computed view JOINs all teams regardless of status,
-- so rejected/pending teams appear in the leaderboard.
--
-- Fix: Recreate the view filtering to only teams with status = 'accepted'.

-- Drop first so we can freely change the column list
DROP VIEW IF EXISTS public.standings_computed;

CREATE VIEW public.standings_computed AS
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
        t.nation,
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
    -- Only include teams that have been accepted into the tournament
    WHERE t.status = 'accepted'
    GROUP BY t.tournament_id, t.id, t.name, t.logo_url, t.color_hex, t.nation
)
SELECT 
    *,
    ROW_NUMBER() OVER (
        PARTITION BY tournament_id 
        ORDER BY pts DESC, gd DESC, gf DESC, team_name ASC
    ) AS rank
FROM aggregated;
