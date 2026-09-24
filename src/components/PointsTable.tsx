'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>('all');

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

  const isGroupFormat = tournament.format === 'round_16' || tournament.format === 'hybrid';

  const groupedStandings = useMemo(() => {
    if (!isGroupFormat) {
      return { 'Global Leaderboard': standings };
    }
    const groups: Record<string, StandingsRow[]> = {
      'Group A': [],
      'Group B': [],
      'Group C': [],
      'Group D': [],
    };
    standings.forEach(row => {
      const g = row.group_name || '';
      if (groups[g]) {
        groups[g].push(row);
      }
    });

    // Ensure sorted per group by Points DESC -> GD DESC -> GF DESC -> Alphabetical
    Object.keys(groups).forEach(g => {
      groups[g].sort((a, b) => {
        if (b.pts !== a.pts) return b.pts - a.pts;
        if (b.gd !== a.gd) return b.gd - a.gd;
        if (b.gf !== a.gf) return b.gf - a.gf;
        return a.team_name.localeCompare(b.team_name);
      });
      // Re-assign per-group rank
      groups[g].forEach((r, idx) => {
        r.rank = idx + 1;
      });
    });

    return groups;
  }, [standings, isGroupFormat]);

  const filteredGroupEntries = useMemo(() => {
    const entries = Object.entries(groupedStandings).sort(([a], [b]) => a.localeCompare(b));
    if (!isGroupFormat || selectedGroupFilter === 'all') {
      return entries;
    }
    return entries.filter(([gName]) => gName === selectedGroupFilter);
  }, [groupedStandings, isGroupFormat, selectedGroupFilter]);

  const getRankBadgeStyle = (rank: number, colorHex: string, isQualified: boolean) => {
    if (isQualified) {
      return {
        background: 'linear-gradient(135deg, #059669, #10B981)', // Emerald green qualification
        color: '#FFFFFF',
        boxShadow: '0 0 10px rgba(16,185,129,0.4)',
      };
    }
    if (rank === 1) {
      return {
        background: 'linear-gradient(135deg, #F59E0B, #FACC15)', // Supernova Gold
        color: '#0f0c29',
        boxShadow: '0 0 12px rgba(250,204,21,0.5)',
      };
    }
    if (rank === 2) {
      return {
        background: 'linear-gradient(135deg, #94A3B8, #CBD5E1)', // Silver
        color: '#0f0c29',
      };
    }
    if (rank === 3) {
      return {
        background: 'linear-gradient(135deg, #B45309, #D97706)', // Bronze
        color: '#FFFFFF',
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
      {/* Dark overlay */}
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
        <div className="px-6 sm:px-8 pt-8 pb-6 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-6">
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
                eFootball Championship Standing
              </p>
              <h1
                className="text-2xl sm:text-3xl font-display font-extrabold uppercase tracking-widest leading-none text-slate-100"
                style={{
                  textShadow: '0 0 30px rgba(34,211,238,0.3)',
                }}
              >
                {isGroupFormat ? 'Group Stage Standings' : 'League Leaderboard'}
              </h1>
              <p
                className="text-sm mt-2 font-mono text-slate-400"
              >
                {tournament.name} · {tournament.sport_type.charAt(0).toUpperCase() + tournament.sport_type.slice(1)}
                {isGroupFormat && (
                  <span className="ml-2 text-emerald-400 font-bold">• Top 2 Per Group Advance to Quarterfinals</span>
                )}
              </p>
            </div>
          </div>

          {/* Group Filter Dropdown */}
          {isGroupFormat && (
            <div className="flex items-center gap-2 bg-slate-900/90 border border-white/10 px-3 py-2 rounded-xl backdrop-blur-md shadow-lg">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
                Filter Group:
              </span>
              <select
                value={selectedGroupFilter}
                onChange={(e) => setSelectedGroupFilter(e.target.value)}
                className="bg-slate-950 border border-white/10 text-xs font-mono font-bold text-accent-cyan rounded-lg px-3 py-1.5 outline-none focus:border-accent-cyan"
              >
                <option value="all">All Groups</option>
                <option value="Group A">Group A</option>
                <option value="Group B">Group B</option>
                <option value="Group C">Group C</option>
                <option value="Group D">Group D</option>
              </select>
            </div>
          )}
        </div>

        {/* === TABLES CONTAINER === */}
        {loading ? (
          <div className="h-64 flex items-center justify-center text-sm font-mono text-slate-500">
            [RE-CALCULATING STANDINGS...]
          </div>
        ) : standings.length === 0 && !isGroupFormat ? (
          <div className="p-16 text-center font-mono text-sm text-slate-500">
            Standings will generate when tournament results are registered.
          </div>
        ) : (
          <div className="px-6 pb-6 w-full">
            <div className={isGroupFormat && selectedGroupFilter === 'all' ? "grid grid-cols-1 lg:grid-cols-2 gap-6 w-full" : "w-full space-y-6"}>
              {filteredGroupEntries.map(([groupName, groupRows]) => (
                <div
                  key={groupName}
                  className="bg-slate-900/80 border border-white/10 rounded-2xl p-4 shadow-xl backdrop-blur-md flex flex-col justify-between overflow-hidden"
                >
                  {/* Group Header */}
                  <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                      <h3 className="text-sm font-display font-extrabold uppercase tracking-wider text-slate-100">
                        {groupName}
                      </h3>
                    </div>
                    {isGroupFormat && (
                      <span className="text-[9px] font-mono font-extrabold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full uppercase tracking-wider">
                        Top 2 Qualify
                      </span>
                    )}
                  </div>

                  <div className="overflow-x-auto w-full">
                    <div className="min-w-[650px]">
                      {/* Column Header Bar */}
                      <div
                        className="rounded-xl px-3 py-2 grid gap-1 text-center text-[9px] font-extrabold uppercase tracking-widest font-mono text-white mb-2"
                        style={{
                          background: 'linear-gradient(90deg, #be185d 0%, #ec4899 40%, #be185d 100%)',
                          boxShadow: '0 4px 15px rgba(236,72,153,0.25)',
                          gridTemplateColumns: '28px 28px minmax(110px,1fr) 30px 30px 30px 30px 35px 35px 35px 40px 80px',
                        }}
                      >
                        <span>Pos</span>
                        <span>Flag</span>
                        <span className="text-left pl-2">Team</span>
                        <span>P</span>
                        <span>W</span>
                        <span>D</span>
                        <span>L</span>
                        <span>GF</span>
                        <span>GA</span>
                        <span>GD</span>
                        <span>PTS</span>
                        <span>Form</span>
                      </div>

                      {/* Group Rows */}
                      <div className="space-y-1">
                        <AnimatePresence initial={false}>
                          {groupRows.length === 0 ? (
                            <div className="p-4 text-center text-xs font-mono text-slate-500">
                              No teams assigned yet.
                            </div>
                          ) : (
                            groupRows.map((row, idx) => {
                              const form = buildFormString(row);
                              const flag = getFlagEmoji(row.nation || '');
                              const isQualified = isGroupFormat ? idx < 2 : row.rank <= 2;

                              const rowBg = isQualified
                                ? (idx % 2 === 0 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(16, 185, 129, 0.06)')
                                : (idx % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.01)');

                              const borderLeftStyle = isQualified
                                ? '4px solid #10B981'
                                : '4px solid transparent';

                              return (
                                <motion.div
                                  key={row.team_id}
                                  layout
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  exit={{ opacity: 0 }}
                                  transition={{ layout: { duration: 0.3 } }}
                                >
                                  <div
                                    className="grid items-center gap-1 px-3 py-2 rounded-lg border-b border-white/5 transition-all group"
                                    style={{
                                      background: rowBg,
                                      borderLeft: borderLeftStyle,
                                      gridTemplateColumns: '28px 28px minmax(110px,1fr) 30px 30px 30px 30px 35px 35px 35px 40px 80px',
                                    }}
                                  >
                                    {/* Rank */}
                                    <div className="flex justify-center">
                                      <span
                                        className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-extrabold font-display shadow-sm"
                                        style={getRankBadgeStyle(idx + 1, row.color_hex, isQualified && isGroupFormat)}
                                      >
                                        {idx + 1}
                                      </span>
                                    </div>

                                    {/* Flag */}
                                    <div className="flex justify-center">
                                      {flag ? (
                                        <span className="text-xl leading-none" title={row.nation}>
                                          {flag}
                                        </span>
                                      ) : (
                                        <div
                                          className="w-5 h-4 rounded-sm border border-white/10"
                                          style={{ background: row.color_hex + '33' }}
                                        />
                                      )}
                                    </div>

                                    {/* Team Name */}
                                    <div className="flex items-center gap-2 pl-1 truncate">
                                      <Avatar
                                        src={row.logo_url}
                                        name={row.team_name}
                                        size="xs"
                                        shape="square"
                                        colorHex={row.color_hex}
                                      />
                                      <div className="truncate flex items-center gap-1.5">
                                        <span className="text-xs font-display font-bold truncate group-hover:text-accent-cyan transition-colors text-slate-100">
                                          {row.team_name}
                                        </span>
                                        {isGroupFormat && isQualified && (
                                          <span className="text-[8px] font-extrabold font-mono px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                            Q
                                          </span>
                                        )}
                                      </div>
                                    </div>

                                    {/* Stats */}
                                    <div className="text-center text-xs font-mono font-bold text-slate-300">{row.mp}</div>
                                    <div className="text-center text-xs font-mono font-bold text-emerald-400">{row.w}</div>
                                    <div className="text-center text-xs font-mono font-bold text-slate-400">{row.d}</div>
                                    <div className="text-center text-xs font-mono font-bold text-rose-400">{row.l}</div>
                                    <div className="text-center text-xs font-mono font-bold text-slate-200">{row.gf}</div>
                                    <div className="text-center text-xs font-mono font-bold text-slate-400">{row.ga}</div>
                                    <div className="text-center text-xs font-mono font-bold" style={{ color: row.gd > 0 ? '#22D3EE' : row.gd < 0 ? '#EF4444' : '#94A3B8' }}>
                                      {row.gd > 0 ? `+${row.gd}` : row.gd}
                                    </div>

                                    {/* Points */}
                                    <div className="flex justify-center items-center">
                                      <span
                                        className="px-2 py-0.5 rounded-md text-xs font-extrabold font-display"
                                        style={{
                                          background: isQualified && isGroupFormat
                                            ? 'rgba(16, 185, 129, 0.25)'
                                            : 'rgba(255, 255, 255, 0.08)',
                                          color: isQualified && isGroupFormat
                                            ? '#10B981'
                                            : '#F8FAFC',
                                          boxShadow: isQualified && isGroupFormat ? '0 0 8px rgba(16,185,129,0.3)' : undefined,
                                        }}
                                      >
                                        {row.pts}
                                      </span>
                                    </div>

                                    {/* Form */}
                                    <div className="flex items-center gap-0.5 justify-center">
                                      {form.length === 0 ? (
                                        <span className="text-[10px] font-mono text-slate-600">—</span>
                                      ) : (
                                        form.map((r, i) => <FormBadge key={i} result={r} />)
                                      )}
                                    </div>
                                  </div>
                                </motion.div>
                              );
                            })
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bottom footer strip */}
        <div className="px-6 py-4 flex items-center justify-between border-t border-white/5 bg-slate-950/20">
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
            Auto-sorted: Points DESC → GD DESC → GF DESC
          </span>
        </div>
      </div>
    </div>
  );
};
