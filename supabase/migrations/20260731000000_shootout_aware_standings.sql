-- supabase/migrations/20260731000000_shootout_aware_standings.sql
--
-- Bug: standings_computed derives W/D/L purely from raw goal scores.
--      A match decided by penalty shootout (metadata_jsonb.shootout.winner present)
--      was always counted as a draw for both teams.
--
-- Fix: Recreate standings_computed joining public.matches so we can inspect
--      metadata_jsonb. If a shootout winner is recorded on a completed match:
--        * The winner is credited with a Win  (3 pts).
--        * The loser  is credited with a Loss (0 pts).
--      GF/GA always use the raw (regular + extra-time) goal count from
--      match_goals_computed — penalty goals are never included.

-- Drop dependent view first
DROP VIEW IF EXISTS public.standings_computed;

-- Recreate with shootout awareness
CREATE VIEW public.standings_computed AS
WITH match_results AS (
    -- Team A perspective
    SELECT
        mg.tournament_id,
        mg.match_id,
        mg.team_a_id                                          AS team_id,
        1                                                     AS matches_played,
        -- Win: raw score win, OR shootout winner is team_a
        CASE
            WHEN m.metadata_jsonb->'shootout'->>'winner' IS NOT NULL
                 THEN CASE WHEN m.metadata_jsonb->'shootout'->>'winner' = mg.team_a_id::text THEN 1 ELSE 0 END
            WHEN mg.team_a_score > mg.team_b_score THEN 1
            ELSE 0
        END AS win,
        -- Draw: only when scores equal AND no shootout winner recorded
        CASE
            WHEN m.metadata_jsonb->'shootout'->>'winner' IS NOT NULL THEN 0
            WHEN mg.team_a_score = mg.team_b_score             THEN 1
            ELSE 0
        END AS draw,
        -- Loss: raw score loss, OR shootout winner is team_b
        CASE
            WHEN m.metadata_jsonb->'shootout'->>'winner' IS NOT NULL
                 THEN CASE WHEN m.metadata_jsonb->'shootout'->>'winner' = mg.team_b_id::text THEN 1 ELSE 0 END
            WHEN mg.team_a_score < mg.team_b_score THEN 1
            ELSE 0
        END AS loss,
        mg.team_a_score AS goals_for,      -- raw score only, never penalty goals
        mg.team_b_score AS goals_against
    FROM public.match_goals_computed mg
    JOIN public.matches m ON m.id = mg.match_id
    WHERE mg.status = 'completed'

    UNION ALL

    -- Team B perspective
    SELECT
        mg.tournament_id,
        mg.match_id,
        mg.team_b_id                                          AS team_id,
        1                                                     AS matches_played,
        CASE
            WHEN m.metadata_jsonb->'shootout'->>'winner' IS NOT NULL
                 THEN CASE WHEN m.metadata_jsonb->'shootout'->>'winner' = mg.team_b_id::text THEN 1 ELSE 0 END
            WHEN mg.team_b_score > mg.team_a_score THEN 1
            ELSE 0
        END AS win,
        CASE
            WHEN m.metadata_jsonb->'shootout'->>'winner' IS NOT NULL THEN 0
            WHEN mg.team_b_score = mg.team_a_score             THEN 1
            ELSE 0
        END AS draw,
        CASE
            WHEN m.metadata_jsonb->'shootout'->>'winner' IS NOT NULL
                 THEN CASE WHEN m.metadata_jsonb->'shootout'->>'winner' = mg.team_a_id::text THEN 1 ELSE 0 END
            WHEN mg.team_b_score < mg.team_a_score THEN 1
            ELSE 0
        END AS loss,
        mg.team_b_score AS goals_for,      -- raw score only
        mg.team_a_score AS goals_against
    FROM public.match_goals_computed mg
    JOIN public.matches m ON m.id = mg.match_id
    WHERE mg.status = 'completed'
),
aggregated AS (
    SELECT
        t.tournament_id,
        t.id          AS team_id,
        t.name        AS team_name,
        t.logo_url,
        t.color_hex,
        t.nation,
        COALESCE(SUM(mr.matches_played), 0)                        AS mp,
        COALESCE(SUM(mr.win),            0)                        AS w,
        COALESCE(SUM(mr.draw),           0)                        AS d,
        COALESCE(SUM(mr.loss),           0)                        AS l,
        COALESCE(SUM(mr.goals_for),      0)                        AS gf,
        COALESCE(SUM(mr.goals_against),  0)                        AS ga,
        COALESCE(SUM(mr.goals_for) - SUM(mr.goals_against), 0)     AS gd,
        COALESCE(SUM(mr.win) * 2 + SUM(mr.draw) * 1, 0)           AS pts
    FROM public.teams t
    LEFT JOIN match_results mr ON mr.team_id = t.id
    -- Only accepted teams appear in the leaderboard
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
