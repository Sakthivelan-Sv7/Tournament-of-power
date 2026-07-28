'use client';

import React, { useState, useEffect } from 'react';
import { db, StandingsRow, Tournament } from '../utils/db';
import { Avatar } from './Avatar';
import { motion, AnimatePresence } from 'framer-motion';

interface PointsTableProps {
  tournament: Tournament;
  refreshTrigger: number;
}

// Country code → flag emoji using regional indicator letters
const getFlagEmoji = (countryCode: string): string => {
  if (!countryCode || countryCode.length !== 2) return '';
  const codePoints = [...countryCode.toUpperCase()].map(
    c => 0x1F1E6 + c.charCodeAt(0) - 65
  );
  return String.fromCodePoint(...codePoints);
};

// Build fake recent form from wins/draws/losses total (last 5 matches approximated)
const buildFormString = (row: StandingsRow): Array<'W' | 'D' | 'L'> => {
  const total = row.mp;
  if (total === 0) return [];
  const form: Array<'W' | 'D' | 'L'> = [];
  
  // Simple heuristic: distribute results over recent matches
  // In a real system this would come from per-match results in order
  const wins = row.w;
  const draws = row.d;
  const losses = row.l;

  // Build a form array of last up to 5 results
  for (let i = 0; i < wins && form.length < 5; i++) form.push('W');
  for (let i = 0; i < draws && form.length < 5; i++) form.push('D');
  for (let i = 0; i < losses && form.length < 5; i++) form.push('L');

  return form.slice(-5);
};

const FormBadge: React.FC<{ result: 'W' | 'D' | 'L' }> = ({ result }) => {
  const styles = {
    W: 'bg-emerald-500 text-white',
    D: 'bg-slate-500 text-white',
    L: 'bg-rose-600 text-white',
  };
  return (
    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-md text-[10px] font-extrabold font-mono ${styles[result]}`}>
      {result}
    </span>
  );
};

// Zone classification labels — mirrors the poster "Champions" / "Pass The Competition" zone
export const PointsTable: React.FC<PointsTableProps> = ({ tournament, refreshTrigger }) => {
  const [standings, setStandings] = useState<StandingsRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStandings = async () => {
      setLoading(true);
      try {
        const data = await db.getStandings(tournament.id);
        setStandings(data);
      } catch (err) {
        console.error('Error fetching standings:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStandings();
  }, [tournament.id, refreshTrigger]);

  const total = standings.length;

  const getRankBadgeStyle = (rank: number, colorHex: string) => {
    if (rank === 1) {
      return {
        background: 'linear-gradient(135deg, #F59E0B, #FACC15)', // Supernova Gold
        color: '#0f0c29',
        boxShadow: '0 0 12px rgba(250,204,21,0.5)',
      };
    }
    if (rank === 2) {
      return {
        background: 'linear-gradient(135deg, #94A3B8, #CBD5E1)', // Forge Gray / Silver
        color: '#0f0c29',
      };
    }
    if (rank === 3) {
      return {
        background: 'linear-gradient(135deg, #B45309, #D97706)', // Bronze
        color: '#FFFFFF',
      };
    }
    if (rank === 4) {
      return {
        background: 'linear-gradient(135deg, #0891B2, #22D3EE)', // Hyperion Cyan
        color: '#0f0c29',
      };
    }
    return {
      background: `linear-gradient(135deg, ${colorHex}33, ${colorHex}66)`,
      color: '#F8FAFC',
    };
  };

  return (
    <div
      className="w-full rounded-3xl overflow-hidden border border-white/5 relative shadow-[0_20px_60px_rgba(0,0,0,0.65)]"
      style={{
        backgroundImage: "url('/images/stadium_bg.png')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {/* Premium dark overlay to ensure maximum text readability */}
      <div
        className="absolute inset-0 bg-slate-950/85 backdrop-blur-[1px] pointer-events-none"
        style={{
          background: 'radial-gradient(circle at 50% 50%, rgba(15,12,41,0.85) 0%, rgba(9,10,15,0.95) 100%)',
        }}
      />

      {/* Decorative glows */}
      <div
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{
          background: 'radial-gradient(ellipse at 30% 20%, rgba(34,211,238,0.15) 0%, transparent 60%), radial-gradient(ellipse at 70% 30%, rgba(250,204,21,0.1) 0%, transparent 60%)',
        }}
      />

      <div className="relative z-10 w-full flex flex-col">
        {/* === EFOOTBALL-STYLE HEADER TITLE SECTION === */}
        <div className="px-6 sm:px-8 pt-8 pb-6 flex flex-col sm:flex-row items-center gap-6">
          <div className="flex-shrink-0">
            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center shadow-2xl border-2"
              style={{
                background: 'linear-gradient(135deg, #161922, #1e2330)',
                borderColor: 'rgba(250,204,21,0.3)',
                boxShadow: '0 0 30px rgba(250,204,21,0.15), inset 0 0 20px rgba(34,211,238,0.05)',
              }}
            >
              <Avatar
                src={tournament.logo_url}
                name={tournament.name}
                size="lg"
                shape="square"
                colorHex="#FACC15"
              />
            </div>
          </div>

          <div className="text-center sm:text-left">
            <p
              className="text-[10px] uppercase tracking-[0.25em] font-extrabold font-mono mb-1 text-accent-cyan"
            >
              Tournament Standing
            </p>
            <h1
              className="text-2xl sm:text-3xl font-display font-extrabold uppercase tracking-widest leading-none text-slate-100"
              style={{
                textShadow: '0 0 30px rgba(34,211,238,0.3)',
              }}
            >
              League Leaderboard
            </h1>
            <p
              className="text-sm mt-2 font-mono text-slate-400"
            >
              {tournament.name} · {tournament.sport_type.charAt(0).toUpperCase() + tournament.sport_type.slice(1)}
            </p>
          </div>
        </div>

        {/* === TABLE CONTAINER (Unified Scroll) === */}
        {loading ? (
          <div className="h-64 flex items-center justify-center text-sm font-mono text-slate-500">
            [RE-CALCULATING STANDINGS...]
          </div>
        ) : standings.length === 0 ? (
          <div className="p-16 text-center font-mono text-sm text-slate-500">
            Standings will generate when tournament results are registered.
          </div>
        ) : (
          <div className="overflow-x-auto w-full">
            <div className="min-w-[800px] pb-4">
              {/* Column header bar — pink/magenta strip */}
              <div
                className="mx-4 rounded-xl px-4 py-3 grid gap-2 text-center text-[10px] font-extrabold uppercase tracking-widest font-mono text-white mb-2"
                style={{
                  background: 'linear-gradient(90deg, #be185d 0%, #ec4899 40%, #be185d 100%)',
                  boxShadow: '0 4px 20px rgba(236,72,153,0.3)',
                  gridTemplateColumns: '36px 36px minmax(140px,1fr) 40px 40px 40px 40px 45px 45px 50px 110px',
                }}
              >
                <span>No</span>
                <span>Flag</span>
                <span className="text-left pl-2">Team / Club</span>
                <span>GP</span>
                <span>W</span>
                <span>D</span>
                <span>L</span>
                <span>GF</span>
                <span>GD</span>
                <span>PTS</span>
                <span>Form</span>
              </div>

              <div className="space-y-0.5">
                <AnimatePresence initial={false}>
                  {standings.map((row, idx) => {
                    const form = buildFormString(row);
                    const flag = getFlagEmoji(row.nation || '');
                    const isTop4 = row.rank <= 4;

                    // Row background highlight for top 4
                    const rowBg = isTop4
                      ? (idx % 2 === 0 ? 'rgba(250,204,21,0.07)' : 'rgba(250,204,21,0.04)')
                      : (idx % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.01)');

                    // Left border qualification zone indicator
                    const borderLeftStyle = isTop4
                      ? '4px solid #FACC15'
                      : '4px solid transparent';

                    return (
                      <motion.div
                        key={row.team_id}
                        layout
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ layout: { duration: 0.4, type: 'spring', stiffness: 250, damping: 30 } }}
                      >
                        {/* Data row */}
                        <div
                          className="grid items-center gap-2 px-4 py-2.5 border-b border-white/5 transition-all group cursor-default"
                          style={{
                            background: rowBg,
                            borderLeft: borderLeftStyle,
                            gridTemplateColumns: '36px 36px minmax(140px,1fr) 40px 40px 40px 40px 45px 45px 50px 110px',
                          }}
                        >
                          {/* Rank number */}
                          <div className="flex justify-center">
                            <span
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-extrabold font-display shadow-md transition-all"
                              style={getRankBadgeStyle(row.rank, row.color_hex)}
                            >
                              {row.rank}
                            </span>
                          </div>

                          {/* Flag */}
                          <div className="flex justify-center">
                            {flag ? (
                              <span className="text-2xl leading-none" title={row.nation}>
                                {flag}
                              </span>
                            ) : (
                              <div
                                className="w-7 h-5 rounded-sm border border-white/10"
                                style={{ background: row.color_hex + '33' }}
                              />
                            )}
                          </div>

                          {/* Team name + logo */}
                          <div className="flex items-center gap-3 pl-1">
                            <Avatar
                              src={row.logo_url}
                              name={row.team_name}
                              size="sm"
                              shape="square"
                              colorHex={row.color_hex}
                            />
                            <div className="truncate">
                              <span
                                className="text-xs sm:text-sm font-display font-bold leading-tight block group-hover:text-accent-cyan transition-colors truncate text-slate-100"
                              >
                                {row.team_name}
                              </span>
                              {row.nation && (
                                <span className="text-[9px] font-mono text-slate-500">
                                  {row.nation}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Stats columns */}
                          {[
                            { val: row.mp, color: undefined },
                            { val: row.w, color: '#10B981' },
                            { val: row.d, color: '#94A3B8' },
                            { val: row.l, color: '#EF4444' },
                            { val: row.gf, color: undefined },
                            { val: row.gd > 0 ? `+${row.gd}` : row.gd, color: row.gd > 0 ? '#22D3EE' : row.gd < 0 ? '#EF4444' : undefined },
                          ].map((cell, i) => (
                            <div key={i} className="text-center">
                              <span
                                className="text-xs sm:text-sm font-mono font-bold"
                                style={{ color: cell.color || 'rgba(248,250,252,0.8)' }}
                              >
                                {cell.val}
                              </span>
                            </div>
                          ))}

                          {/* PTS — highlighted Gold/Cyan for top rows */}
                          <div className="flex justify-center items-center">
                            <span
                              className="px-2.5 py-0.5 rounded-lg text-xs sm:text-sm font-extrabold font-display"
                              style={{
                                background: row.rank === 1
                                  ? 'linear-gradient(135deg, #F59E0B, #FACC15)'
                                  : isTop4
                                    ? 'rgba(34, 211, 238, 0.15)'
                                    : 'rgba(255, 255, 255, 0.05)',
                                color: row.rank === 1
                                  ? '#0f0c29'
                                  : isTop4
                                    ? '#22D3EE'
                                    : 'rgba(248,250,252,0.85)',
                                boxShadow: row.rank === 1 ? '0 0 15px rgba(250,204,21,0.3)' : undefined,
                              }}
                            >
                              {row.pts}
                            </span>
                          </div>

                          {/* Form badges */}
                          <div className="flex items-center gap-1 justify-center flex-wrap">
                            {form.length === 0 ? (
                              <span className="text-[10px] font-mono text-slate-600">—</span>
                            ) : (
                              form.map((r, i) => <FormBadge key={i} result={r} />)
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </div>
          </div>
        )}

        {/* Bottom footer strip inside card */}
        <div
          className="px-6 py-4 flex items-center justify-between border-t border-white/5 bg-slate-950/20"
        >
          <div className="flex items-center gap-4 text-[10px] font-mono text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-emerald-500" /> Win
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-slate-500" /> Draw
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-rose-600" /> Loss
            </span>
          </div>
          <span className="text-[10px] font-mono text-slate-600">
            Auto-sorted · Computed from match events
          </span>
        </div>
      </div>
    </div>
  );
};
