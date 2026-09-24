'use client';

import React from 'react';
import { Match, Team } from '../utils/db';
import { Avatar } from './Avatar';
import { Trophy, Crown, CheckCircle, Play, Clock, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

interface KnockoutBracketProps {
  matches: Match[];
  teams: Team[];
  onSelectMatch?: (matchId: string) => void;
}

export const KnockoutBracket: React.FC<KnockoutBracketProps> = ({
  matches,
  teams,
  onSelectMatch,
}) => {
  const getTeam = (teamId: string) => teams.find((t) => t.id === teamId);

  // Filter matches by round
  const qfMatches = matches
    .filter((m) => m.round_name === 'Quarterfinals')
    .sort((a, b) => (a.metadata_jsonb?.match_index ?? 0) - (b.metadata_jsonb?.match_index ?? 0));

  const sfMatches = matches
    .filter((m) => m.round_name === 'Semifinals')
    .sort((a, b) => (a.metadata_jsonb?.match_index ?? 0) - (b.metadata_jsonb?.match_index ?? 0));

  const finalMatches = matches.filter(
    (m) => m.round_name === 'Finals' || m.round_name === 'Grand Final' || m.round_name === 'Final'
  );

  // Determine Champion if final is completed
  const grandFinal = finalMatches[0];
  let championTeam: Team | undefined = undefined;
  if (grandFinal && grandFinal.status === 'completed') {
    const shootoutWinner = (grandFinal as any).metadata_jsonb?.shootout?.winner;
    const winnerId =
      shootoutWinner ||
      (grandFinal.team_a_score! > grandFinal.team_b_score!
        ? grandFinal.team_a_id
        : grandFinal.team_b_id);
    championTeam = getTeam(winnerId);
  }

  const renderMatchCard = (match?: Match, defaultLabel: string = 'TBD Match', themeColor: 'silver' | 'blue' | 'gold' = 'silver') => {
    if (!match) {
      return (
        <div className="w-60 bg-slate-900/60 border border-white/5 rounded-2xl p-3.5 flex flex-col justify-center items-center opacity-40">
          <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest font-bold mb-2">
            {defaultLabel}
          </span>
          <div className="w-full space-y-2">
            <div className="flex items-center justify-between p-2 rounded-xl bg-white/5">
              <span className="text-xs font-mono text-slate-400">TBD</span>
              <span className="text-xs font-mono text-slate-500">-</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-xl bg-white/5">
              <span className="text-xs font-mono text-slate-400">TBD</span>
              <span className="text-xs font-mono text-slate-500">-</span>
            </div>
          </div>
        </div>
      );
    }

    const teamA = getTeam(match.team_a_id);
    const teamB = getTeam(match.team_b_id);

    const isTbdA = match.team_a_id.startsWith('placeholder-');
    const isTbdB = match.team_b_id.startsWith('placeholder-');

    const nameA = isTbdA ? 'TBD' : teamA?.name || 'Unknown';
    const nameB = isTbdB ? 'TBD' : teamB?.name || 'Unknown';

    const shootoutWinner = (match as any).metadata_jsonb?.shootout?.winner;
    const isWinnerA =
      match.status === 'completed' &&
      (shootoutWinner ? shootoutWinner === match.team_a_id : (match.team_a_score ?? 0) > (match.team_b_score ?? 0));
    const isWinnerB =
      match.status === 'completed' &&
      (shootoutWinner ? shootoutWinner === match.team_b_id : (match.team_b_score ?? 0) > (match.team_a_score ?? 0));

    const borderHover =
      themeColor === 'gold'
        ? 'hover:border-amber-400/60'
        : themeColor === 'blue'
        ? 'hover:border-cyan-400/60'
        : 'hover:border-slate-300/60';

    const labelColor =
      themeColor === 'gold'
        ? 'text-amber-400'
        : themeColor === 'blue'
        ? 'text-cyan-400'
        : 'text-slate-300';

    return (
      <motion.div
        whileHover={{ scale: 1.03 }}
        onClick={() => onSelectMatch?.(match.id)}
        className={`w-60 bg-slate-900/90 border border-white/10 ${borderHover} rounded-2xl p-3.5 shadow-xl backdrop-blur-md cursor-pointer transition-all relative group`}
      >
        {/* Header pill */}
        <div className="flex items-center justify-between mb-2.5 border-b border-white/5 pb-2">
          <span className={`text-[9px] font-mono font-extrabold uppercase tracking-widest ${labelColor}`}>
            {match.metadata_jsonb?.pairing_label || match.round_name}
          </span>
          {match.status === 'completed' && (
            <span className="flex items-center gap-1 text-[9px] font-mono font-bold text-emerald-400">
              <CheckCircle className="w-3 h-3" /> FT
            </span>
          )}
          {match.status === 'in_progress' && (
            <span className="flex items-center gap-1 text-[9px] font-mono font-bold text-cyan-400 animate-pulse">
              <Play className="w-3 h-3" /> LIVE
            </span>
          )}
          {match.status === 'scheduled' && (
            <span className="flex items-center gap-1 text-[9px] font-mono font-bold text-slate-400">
              <Clock className="w-3 h-3" /> SCHED
            </span>
          )}
        </div>

        {/* Team A Row */}
        <div
          className={`flex items-center justify-between p-2 rounded-xl transition-colors mb-1.5 ${
            isWinnerA
              ? 'bg-emerald-500/20 border border-emerald-500/40'
              : 'bg-white/5 group-hover:bg-white/10'
          }`}
        >
          <div className="flex items-center gap-2 truncate">
            <Avatar
              src={teamA?.logo_url}
              name={nameA}
              size="xs"
              shape="square"
              colorHex={teamA?.color_hex || '#334155'}
            />
            <span
              className={`text-xs font-display font-bold truncate ${
                isWinnerA ? 'text-emerald-300 font-extrabold' : 'text-slate-200'
              }`}
            >
              {nameA}
            </span>
          </div>
          <span
            className={`text-xs font-mono font-extrabold px-2 py-0.5 rounded ${
              isWinnerA ? 'bg-emerald-500 text-slate-950' : 'text-slate-300'
            }`}
          >
            {match.status === 'scheduled' ? '-' : match.team_a_score ?? 0}
          </span>
        </div>

        {/* Team B Row */}
        <div
          className={`flex items-center justify-between p-2 rounded-xl transition-colors ${
            isWinnerB
              ? 'bg-emerald-500/20 border border-emerald-500/40'
              : 'bg-white/5 group-hover:bg-white/10'
          }`}
        >
          <div className="flex items-center gap-2 truncate">
            <Avatar
              src={teamB?.logo_url}
              name={nameB}
              size="xs"
              shape="square"
              colorHex={teamB?.color_hex || '#334155'}
            />
            <span
              className={`text-xs font-display font-bold truncate ${
                isWinnerB ? 'text-emerald-300 font-extrabold' : 'text-slate-200'
              }`}
            >
              {nameB}
            </span>
          </div>
          <span
            className={`text-xs font-mono font-extrabold px-2 py-0.5 rounded ${
              isWinnerB ? 'bg-emerald-500 text-slate-950' : 'text-slate-300'
            }`}
          >
            {match.status === 'scheduled' ? '-' : match.team_b_score ?? 0}
          </span>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="w-full overflow-x-auto py-8 px-4 bg-slate-950/60 border border-white/10 rounded-3xl backdrop-blur-md shadow-2xl relative">
      {/* Background UEFA Champions League Aesthetic Banner */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-cyan/10 border border-accent-cyan/20 text-accent-cyan text-[10px] font-mono font-extrabold uppercase tracking-widest mb-1">
          <Sparkles className="w-3.5 h-3.5" /> Road to Final — Knockout Roadmap
        </div>
        <h2 className="text-xl font-display font-extrabold text-slate-100 uppercase tracking-widest">
          eFootball Championship Bracket
        </h2>
      </div>

      <div className="min-w-[1150px] flex items-center justify-center gap-8 px-4 relative z-10">
        
        {/* === LEFT WING: SILVER PATH === */}
        <div className="flex items-center gap-8">
          {/* Column 1: QF 1 & QF 2 */}
          <div className="flex flex-col gap-8 items-center">
            <div className="text-center border-b border-slate-700/50 pb-1 w-full">
              <span className="text-[10px] font-mono font-extrabold uppercase tracking-widest text-slate-300">
                Left Wing · QF 1 &amp; QF 2
              </span>
            </div>
            <div className="space-y-6">
              {renderMatchCard(qfMatches[0], 'QF 1 (1A vs 2B)', 'silver')}
              {renderMatchCard(qfMatches[1], 'QF 2 (1C vs 2D)', 'silver')}
            </div>
          </div>

          {/* Connector Arrow */}
          <div className="text-slate-600 font-mono text-xl font-bold">→</div>

          {/* Column 2: SF 1 */}
          <div className="flex flex-col gap-8 items-center my-auto">
            <div className="text-center border-b border-slate-700/50 pb-1 w-full">
              <span className="text-[10px] font-mono font-extrabold uppercase tracking-widest text-slate-300">
                Semi-Final 1
              </span>
            </div>
            {renderMatchCard(sfMatches[0], 'SF 1 (Winner QF1 vs QF2)', 'silver')}
          </div>
        </div>

        {/* Connector Arrow to Center */}
        <div className="text-amber-400 font-mono text-2xl font-bold">→</div>

        {/* === CENTER FOCUS: GRAND FINAL & CHAMPION === */}
        <div className="flex flex-col gap-6 items-center px-4 py-6 bg-slate-900/90 border-2 border-amber-500/30 rounded-3xl shadow-[0_0_40px_rgba(250,204,21,0.1)]">
          <div className="text-center">
            <span className="text-[10px] font-mono font-extrabold uppercase tracking-widest text-amber-400 block">
              ★ GRAND FINAL ★
            </span>
            <h3 className="text-sm font-display font-extrabold text-slate-100 uppercase tracking-wider">
              Championship Match
            </h3>
          </div>

          {renderMatchCard(grandFinal, 'Grand Final (SF 1 vs SF 2)', 'gold')}

          {/* Champion Crown Card */}
          {championTeam ? (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-60 p-4 rounded-2xl bg-gradient-to-r from-amber-500/20 via-yellow-500/30 to-amber-500/20 border-2 border-amber-400 text-center shadow-[0_0_30px_rgba(251,191,36,0.3)]"
            >
              <Crown className="w-8 h-8 text-amber-400 mx-auto mb-1 animate-bounce" />
              <span className="text-[10px] font-mono font-extrabold uppercase tracking-widest text-amber-300 block">
                TOURNAMENT CHAMPION
              </span>
              <h3 className="text-base font-display font-extrabold text-white mt-1">
                {championTeam.name}
              </h3>
            </motion.div>
          ) : (
            <div className="w-60 p-3 rounded-2xl bg-slate-950/50 border border-white/5 text-center opacity-60">
              <Trophy className="w-6 h-6 text-slate-600 mx-auto mb-1" />
              <span className="text-[9px] font-mono text-slate-500 uppercase font-bold tracking-widest">
                Champion Trophy Awaits
              </span>
            </div>
          )}
        </div>

        {/* Connector Arrow from Right */}
        <div className="text-cyan-400 font-mono text-2xl font-bold">←</div>

        {/* === RIGHT WING: BLUE PATH === */}
        <div className="flex items-center gap-8">
          {/* Column 4: SF 2 */}
          <div className="flex flex-col gap-8 items-center my-auto">
            <div className="text-center border-b border-cyan-700/50 pb-1 w-full">
              <span className="text-[10px] font-mono font-extrabold uppercase tracking-widest text-cyan-400">
                Semi-Final 2
              </span>
            </div>
            {renderMatchCard(sfMatches[1], 'SF 2 (Winner QF3 vs QF4)', 'blue')}
          </div>

          {/* Connector Arrow */}
          <div className="text-cyan-600 font-mono text-xl font-bold">←</div>

          {/* Column 5: QF 3 & QF 4 */}
          <div className="flex flex-col gap-8 items-center">
            <div className="text-center border-b border-cyan-700/50 pb-1 w-full">
              <span className="text-[10px] font-mono font-extrabold uppercase tracking-widest text-cyan-400">
                Right Wing · QF 3 &amp; QF 4
              </span>
            </div>
            <div className="space-y-6">
              {renderMatchCard(qfMatches[2], 'QF 3 (1B vs 2A)', 'blue')}
              {renderMatchCard(qfMatches[3], 'QF 4 (1D vs 2C)', 'blue')}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
