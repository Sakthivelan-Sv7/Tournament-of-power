'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { db, Match, Team, Tournament } from '../utils/db';
import { Avatar } from './Avatar';
import { Calendar, Filter, Play, CheckCircle, Clock, ShieldAlert, X, Save } from 'lucide-react';
import { checkAndGenerateNextKnockoutRound } from '../utils/formatEngine';

interface FixturesProps {
  tournament: Tournament;
  teams: Team[];
  onSelectMatch: (matchId: string) => void;
  refreshTrigger: number;
  isAdmin?: boolean;
  onRefresh?: () => void;
}

interface QuickScoreState {
  match: Match;
  teamA: Team;
  teamB: Team;
  scoreA: number;
  scoreB: number;
  status: Match['status'];
  saving: boolean;
}

export const Fixtures: React.FC<FixturesProps> = ({
  tournament,
  teams,
  onSelectMatch,
  refreshTrigger,
  isAdmin = false,
  onRefresh,
}) => {
  const [matches, setMatches] = useState<Match[]>([]);
  const [rounds, setRounds] = useState<string[]>([]);
  const [selectedRound, setSelectedRound] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  // Quick Score modal state
  const [quickScore, setQuickScore] = useState<QuickScoreState | null>(null);

  const fetchMatches = useCallback(async () => {
    setLoading(true);
    try {
      const data = await db.getMatches(tournament.id);
      setMatches(data);

      const uniqueRounds = Array.from(new Set(data.map((m) => m.round_name)));
      uniqueRounds.sort((a, b) => {
        const numA = parseInt(a.replace(/\D/g, ''), 10);
        const numB = parseInt(b.replace(/\D/g, ''), 10);
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        return a.localeCompare(b);
      });

      setRounds(uniqueRounds);
      if (uniqueRounds.length > 0 && selectedRound === 'all') {
        setSelectedRound(uniqueRounds[0]);
      }
    } catch (err) {
      console.error('Error fetching matches:', err);
    } finally {
      setLoading(false);
    }
  }, [tournament.id, refreshTrigger, selectedRound]);

  useEffect(() => {
    fetchMatches();
  }, [fetchMatches]);

  const getTeam = (teamId: string): Team | undefined =>
    teams.find((t) => t.id === teamId);

  const filteredMatches =
    selectedRound === 'all'
      ? matches
      : matches.filter((m) => m.round_name === selectedRound);

  // ── Admin: open Quick Score modal ──────────────────────────────────────────
  const openQuickScore = (e: React.MouseEvent, m: Match) => {
    e.stopPropagation(); // prevent card click bubbling
    const tA = getTeam(m.team_a_id);
    const tB = getTeam(m.team_b_id);
    if (!tA || !tB) return;
    setQuickScore({
      match: m,
      teamA: tA,
      teamB: tB,
      scoreA: m.team_a_score ?? 0,
      scoreB: m.team_b_score ?? 0,
      status: m.status === 'scheduled' ? 'in_progress' : m.status,
      saving: false,
    });
  };

  // ── Admin: save Quick Score ────────────────────────────────────────────────
  const handleSaveQuickScore = async () => {
    if (!quickScore) return;
    setQuickScore((qs) => qs && { ...qs, saving: true });

    try {
      const { match, teamA, teamB, scoreA, scoreB, status } = quickScore;

      // 1. Delete existing goal events for this match so we can rewrite them
      const existingEvents = await db.getMatchEvents(match.id);
      const goalEvents = existingEvents.filter(
        (ev) => ev.event_type === 'goal' || ev.event_type === 'own_goal'
      );
      await Promise.all(goalEvents.map((ev) => db.deleteMatchEvent(ev.id)));

      // 2. Insert synthetic goal events equal to the score totals
      const addGoals = async (teamId: string, count: number) => {
        for (let i = 0; i < count; i++) {
          await db.addMatchEvent({
            match_id: match.id,
            team_id: teamId,
            event_type: 'goal',
            minute: (i + 1) * 10,
            metadata_jsonb: { quick_score: true },
          });
        }
      };

      await addGoals(teamA.id, scoreA);
      await addGoals(teamB.id, scoreB);

      // 3. Update match status
      await db.updateMatchStatus(match.id, status);

      // 4. Propagate knockout bracket if completed
      if (status === 'completed') {
        await checkAndGenerateNextKnockoutRound(match.tournament_id);
      }

      setQuickScore(null);
      await fetchMatches();
      onRefresh?.();
    } catch (err) {
      console.error('Quick score save error:', err);
      setQuickScore((qs) => qs && { ...qs, saving: false });
    }
  };

  return (
    <>
      <div className="w-full space-y-6">
        {/* Header and Filter Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-display font-bold text-lg text-foreground flex items-center gap-2">
              <Calendar className="w-5 h-5 text-accent-gold" /> Matches &amp; Fixtures
            </h3>
            <p className="text-xs text-nebula-gray mt-0.5">
              {isAdmin
                ? 'Click a match card to view details, or use the ⚡ Score button to quickly enter results.'
                : 'Select a match to log events or view detailed stats.'}
            </p>
          </div>

          {rounds.length > 0 && (
            <div className="flex items-center gap-2 bg-surface p-1 rounded-xl border border-white/5">
              <span className="text-[10px] text-nebula-gray font-bold uppercase tracking-wider pl-3 pr-1 flex items-center gap-1.5">
                <Filter className="w-3 h-3 text-accent-gold" /> Filter Round:
              </span>
              <select
                value={selectedRound}
                onChange={(e) => setSelectedRound(e.target.value)}
                className="bg-background border-none focus:ring-0 text-xs text-foreground font-semibold rounded-lg px-3 py-1.5 outline-none"
              >
                <option value="all">All Rounds</option>
                {rounds.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {loading ? (
          <div className="h-64 flex items-center justify-center text-sm text-nebula-gray font-mono">
            [LOADING SCHEDULE...]
          </div>
        ) : matches.length === 0 ? (
          <div className="border border-white/5 rounded-3xl p-12 text-center bg-surface/10 text-nebula-gray">
            No matches scheduled. Start the tournament in the Registry tab.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredMatches.map((m) => {
              const teamA = getTeam(m.team_a_id);
              const teamB = getTeam(m.team_b_id);

              const isTbdA = m.team_a_id.startsWith('placeholder-');
              const isTbdB = m.team_b_id.startsWith('placeholder-');

              const nameA = isTbdA
                ? `TBD (Winner of M${parseInt(m.team_a_id.split('-')[1]) + 1})`
                : teamA?.name || 'Unknown';
              const nameB = isTbdB
                ? `TBD (Winner of M${parseInt(m.team_b_id.split('-')[1]) + 1})`
                : teamB?.name || 'Unknown';

              const canInteract = !isTbdA && !isTbdB;

              return (
                <div
                  key={m.id}
                  onClick={() => canInteract && onSelectMatch(m.id)}
                  className={`relative bg-surface/30 border border-white/5 rounded-2xl p-5 transition-all flex flex-col justify-between ${
                    canInteract
                      ? 'hover:bg-surface-hover hover:border-white/10 cursor-pointer'
                      : 'opacity-60 cursor-not-allowed'
                  }`}
                >
                  {/* Round indicator and status */}
                  <div className="flex items-center justify-between border-b border-white/5 pb-3 mb-4">
                    <span className="text-[10px] bg-white/5 border border-white/10 px-2 py-0.5 rounded font-mono text-nebula-gray font-bold uppercase tracking-wider">
                      {m.round_name}
                    </span>
                    <div className="flex items-center gap-2">
                      {m.status === 'in_progress' && (
                        <span className="flex items-center gap-1 text-[10px] text-accent-cyan font-bold uppercase tracking-wider font-mono">
                          <Play className="w-3 h-3 animate-pulse" /> Live
                        </span>
                      )}
                      {m.status === 'completed' && (
                        <span className="flex items-center gap-1 text-[10px] text-success font-bold uppercase tracking-wider font-mono">
                          <CheckCircle className="w-3 h-3" /> FT
                        </span>
                      )}
                      {m.status === 'scheduled' && (
                        <span className="flex items-center gap-1 text-[10px] text-nebula-gray font-bold uppercase tracking-wider font-mono">
                          <Clock className="w-3 h-3" /> Scheduled
                        </span>
                      )}

                      {/* Admin Quick Score Button */}
                      {isAdmin && canInteract && (
                        <button
                          onClick={(e) => openQuickScore(e, m)}
                          title="Admin: Set Score"
                          className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider font-mono rounded bg-accent-gold/10 border border-accent-gold/30 text-accent-gold hover:bg-accent-gold/20 hover:border-accent-gold/60 transition-all"
                        >
                          <ShieldAlert className="w-3 h-3" /> Score
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Score / Teams Grid */}
                  <div className="grid grid-cols-7 items-center justify-center my-2 gap-2">
                    {/* Team A */}
                    <div className="col-span-3 flex flex-col items-center text-center">
                      <Avatar
                        src={teamA?.logo_url}
                        name={nameA}
                        size="sm"
                        shape="square"
                        colorHex={teamA?.color_hex}
                      />
                      <span className="text-xs font-semibold text-foreground mt-2 line-clamp-1">
                        {nameA}
                      </span>
                    </div>

                    {/* Score or VS divider */}
                    <div className="col-span-1 flex flex-col items-center justify-center">
                      {m.status === 'scheduled' ? (
                        <span className="text-xs text-nebula-gray font-bold uppercase tracking-wider font-mono bg-white/5 px-2 py-1 rounded">
                          VS
                        </span>
                      ) : (
                        <div className="flex items-center justify-center gap-1 font-mono text-xl font-bold bg-background border border-white/5 px-3 py-1.5 rounded-xl text-foreground">
                          <span
                            className={
                              m.team_a_score! > m.team_b_score!
                                ? 'text-accent-gold'
                                : ''
                            }
                          >
                            {m.team_a_score}
                          </span>
                          <span className="text-white/20">:</span>
                          <span
                            className={
                              m.team_b_score! > m.team_a_score!
                                ? 'text-accent-gold'
                                : ''
                            }
                          >
                            {m.team_b_score}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Team B */}
                    <div className="col-span-3 flex flex-col items-center text-center">
                      <Avatar
                        src={teamB?.logo_url}
                        name={nameB}
                        size="sm"
                        shape="square"
                        colorHex={teamB?.color_hex}
                      />
                      <span className="text-xs font-semibold text-foreground mt-2 line-clamp-1">
                        {nameB}
                      </span>
                    </div>
                  </div>

                  {/* Scheduled time */}
                  <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[10px] text-nebula-gray font-mono">
                    <span>Match Time:</span>
                    <span>
                      {new Date(m.scheduled_at).toLocaleString([], {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Quick Score Modal ─────────────────────────────────────────────────── */}
      {quickScore && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={() => !quickScore.saving && setQuickScore(null)}
        >
          <div
            className="relative w-full max-w-md bg-[#0f1117] border border-white/10 rounded-3xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-surface/60">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-accent-gold" />
                <span className="text-xs font-bold uppercase tracking-widest text-accent-gold font-mono">
                  Admin — Set Match Score
                </span>
              </div>
              <button
                onClick={() => !quickScore.saving && setQuickScore(null)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-nebula-gray hover:text-foreground transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-6 py-6 space-y-6">
              {/* Round info */}
              <div className="text-center">
                <span className="text-[10px] bg-white/5 border border-white/10 px-3 py-1 rounded-full font-mono text-nebula-gray font-bold uppercase tracking-widest">
                  {quickScore.match.round_name}
                </span>
              </div>

              {/* Score Inputs */}
              <div className="grid grid-cols-7 items-center gap-3">
                {/* Team A */}
                <div className="col-span-3 flex flex-col items-center gap-3">
                  <Avatar
                    src={quickScore.teamA.logo_url}
                    name={quickScore.teamA.name}
                    size="md"
                    shape="square"
                    colorHex={quickScore.teamA.color_hex}
                  />
                  <span className="text-xs font-bold text-foreground text-center line-clamp-2">
                    {quickScore.teamA.name}
                  </span>
                  <input
                    id="qs-score-a"
                    type="number"
                    min={0}
                    max={99}
                    value={quickScore.scoreA}
                    onChange={(e) =>
                      setQuickScore((qs) =>
                        qs
                          ? { ...qs, scoreA: Math.max(0, parseInt(e.target.value) || 0) }
                          : null
                      )
                    }
                    className="w-full text-center text-3xl font-extrabold font-mono bg-background border-2 border-accent-gold/30 focus:border-accent-gold rounded-2xl py-3 text-foreground outline-none transition-all"
                  />
                </div>

                {/* Divider */}
                <div className="col-span-1 flex flex-col items-center justify-center gap-1 mt-8">
                  <span className="text-2xl font-extrabold text-white/20 font-mono">:</span>
                </div>

                {/* Team B */}
                <div className="col-span-3 flex flex-col items-center gap-3">
                  <Avatar
                    src={quickScore.teamB.logo_url}
                    name={quickScore.teamB.name}
                    size="md"
                    shape="square"
                    colorHex={quickScore.teamB.color_hex}
                  />
                  <span className="text-xs font-bold text-foreground text-center line-clamp-2">
                    {quickScore.teamB.name}
                  </span>
                  <input
                    id="qs-score-b"
                    type="number"
                    min={0}
                    max={99}
                    value={quickScore.scoreB}
                    onChange={(e) =>
                      setQuickScore((qs) =>
                        qs
                          ? { ...qs, scoreB: Math.max(0, parseInt(e.target.value) || 0) }
                          : null
                      )
                    }
                    className="w-full text-center text-3xl font-extrabold font-mono bg-background border-2 border-accent-gold/30 focus:border-accent-gold rounded-2xl py-3 text-foreground outline-none transition-all"
                  />
                </div>
              </div>

              {/* Match Status Selector */}
              <div className="space-y-2">
                <label className="block text-[10px] uppercase tracking-widest font-bold text-nebula-gray">
                  Match Status
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['scheduled', 'in_progress', 'completed'] as Match['status'][]).map((s) => (
                    <button
                      key={s}
                      onClick={() =>
                        setQuickScore((qs) => (qs ? { ...qs, status: s } : null))
                      }
                      className={`py-2 rounded-lg text-xs font-bold uppercase transition-all ${
                        quickScore.status === s
                          ? s === 'completed'
                            ? 'bg-success/20 border border-success text-success'
                            : s === 'in_progress'
                            ? 'bg-accent-cyan/15 border border-accent-cyan text-accent-cyan'
                            : 'bg-white/10 border border-white/30 text-white'
                          : 'bg-surface border border-white/5 text-nebula-gray hover:bg-surface-hover'
                      }`}
                    >
                      {s === 'scheduled' ? 'Scheduled' : s === 'in_progress' ? '▶ Live' : '✓ Full Time'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Info note */}
              <p className="text-[10px] text-nebula-gray/60 text-center font-mono leading-relaxed">
                This overwrites existing goal events with synthetic ones matching the score totals.
                For detailed per-player events, use the Match Center.
              </p>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => setQuickScore(null)}
                  disabled={quickScore.saving}
                  className="flex-1 py-3 rounded-xl text-xs font-bold border border-white/10 text-nebula-gray hover:bg-white/5 transition-all disabled:opacity-40"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveQuickScore}
                  disabled={quickScore.saving}
                  className="flex-1 py-3 rounded-xl text-xs font-bold bg-accent-gold hover:bg-yellow-400 text-background transition-all flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(250,204,21,0.2)] disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {quickScore.saving ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-background/30 border-t-background rounded-full animate-spin" />
                      Saving…
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" /> Save Score
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
