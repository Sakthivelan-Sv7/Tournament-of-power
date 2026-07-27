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
const getZoneLabel = (rank: number, total: number): { label: string; color: string } | null => {
  if (rank === 1) return { label: 'Champions', color: '#FFD700' };
  if (rank <= 2) return { label: 'Runner-Up', color: '#C0C0C0' };
  if (rank <= Math.ceil(total * 0.5)) return { label: 'Pass The Competition', color: '#EC4899' };
  return null;
};

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

  return (
    <div className="w-full space-y-0">
      {/* === EFOOTBALL-STYLE HEADER SECTION === */}
      <div
        className="rounded-t-3xl overflow-hidden relative"
        style={{
          background: 'linear-gradient(135deg, #0f0c29 0%, #302b63 40%, #1a1a4e 70%, #0f0c29 100%)',
        }}
      >
        {/* Decorative radial glow behind header */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at 30% 50%, rgba(236,72,153,0.18) 0%, transparent 60%), radial-gradient(ellipse at 70% 50%, rgba(99,102,241,0.18) 0%, transparent 60%)',
          }}
        />

        {/* Header row: Logo left + Title right */}
        <div className="relative z-10 px-8 pt-8 pb-6 flex flex-col sm:flex-row items-center gap-6">
          <div className="flex-shrink-0">
            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center shadow-2xl border-2"
              style={{
                background: 'linear-gradient(135deg, #1a1a4e, #302b63)',
                borderColor: 'rgba(236,72,153,0.4)',
                boxShadow: '0 0 30px rgba(236,72,153,0.25), inset 0 0 20px rgba(99,102,241,0.15)',
              }}
            >
              <Avatar
                src={tournament.logo_url}
                name={tournament.name}
                size="lg"
                shape="square"
                colorHex="#EC4899"
              />
            </div>
          </div>

          <div className="text-center sm:text-left">
            <p
              className="text-[10px] uppercase tracking-[0.25em] font-bold font-mono mb-1"
              style={{ color: 'rgba(236,72,153,0.8)' }}
            >
              eFootball Tournament
            </p>
            <h1
              className="text-2xl sm:text-3xl font-display font-extrabold uppercase tracking-widest leading-none"
              style={{
                color: '#F8FAFC',
                textShadow: '0 0 30px rgba(236,72,153,0.5)',
              }}
            >
              Football League Standing
            </h1>
            <p
              className="text-sm mt-2 font-mono"
              style={{ color: 'rgba(248,250,252,0.55)' }}
            >
              {tournament.name} · {tournament.sport_type.charAt(0).toUpperCase() + tournament.sport_type.slice(1)}
            </p>
          </div>
        </div>

        {/* Column header bar — pink/magenta strip */}
        <div
          className="relative z-10 mx-4 rounded-xl px-4 py-3 grid gap-2 text-center text-[10px] font-extrabold uppercase tracking-widest font-mono text-white"
          style={{
            background: 'linear-gradient(90deg, #be185d 0%, #ec4899 40%, #be185d 100%)',
            boxShadow: '0 4px 20px rgba(236,72,153,0.4)',
            gridTemplateColumns: '36px 36px minmax(160px,1fr) 40px 40px 40px 40px 48px 48px 48px 52px auto',
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
          <span className="col-span-1">Form</span>
        </div>

        {/* Bottom padding inside gradient card */}
        <div className="h-4" />
      </div>

      {/* === TABLE BODY === */}
      <div
        className="rounded-b-3xl overflow-hidden relative"
        style={{
          background: 'linear-gradient(180deg, #1a1a4e 0%, #0f0c29 100%)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
        }}
      >
        {loading ? (
          <div
            className="h-64 flex items-center justify-center text-sm font-mono"
            style={{ color: 'rgba(248,250,252,0.4)' }}
          >
            [RE-CALCULATING STANDINGS...]
          </div>
        ) : standings.length === 0 ? (
          <div
            className="p-16 text-center font-mono text-sm"
            style={{ color: 'rgba(248,250,252,0.35)' }}
          >
            Standings will generate when tournament results are registered.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <AnimatePresence initial={false}>
              {standings.map((row, idx) => {
                const zone = getZoneLabel(row.rank, total);
                const form = buildFormString(row);
                const flag = getFlagEmoji(row.nation || '');
                const isChampion = row.rank === 1;
                const isRunnerUp = row.rank === 2;

                const prevZone = idx === 0 ? null : getZoneLabel(idx, total);
                const showZoneLabel = zone && (!prevZone || prevZone.label !== zone.label);
                
                // Alternating row backgrounds inspired by poster
                const rowBg = idx % 2 === 0
                  ? 'rgba(255,255,255,0.04)'
                  : 'rgba(255,255,255,0.02)';

                return (
                  <motion.div
                    key={row.team_id}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ layout: { duration: 0.4, type: 'spring', stiffness: 250, damping: 30 } }}
                  >
                    {/* Zone label divider — like the poster's side annotations */}
                    {showZoneLabel && zone && (
                      <div
                        className="px-4 py-1.5 flex items-center gap-2 border-t"
                        style={{ borderColor: `${zone.color}30`, background: `${zone.color}10` }}
                      >
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: zone.color }} />
                        <span
                          className="text-[9px] uppercase font-extrabold tracking-widest font-mono"
                          style={{ color: zone.color }}
                        >
                          {zone.label}
                        </span>
                      </div>
                    )}

                    {/* Data row */}
                    <div
                      className="grid items-center gap-2 px-4 py-3 border-b transition-all group cursor-default"
                      style={{
                        background: rowBg,
                        borderColor: 'rgba(255,255,255,0.04)',
                        gridTemplateColumns: '36px 36px minmax(160px,1fr) 40px 40px 40px 40px 48px 48px 48px auto',
                      }}
                    >
                      {/* Rank number */}
                      <div className="flex justify-center">
                        <span
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-extrabold font-display shadow-md"
                          style={{
                            background: isChampion
                              ? 'linear-gradient(135deg, #F59E0B, #FACC15)'
                              : isRunnerUp
                                ? 'linear-gradient(135deg, #94A3B8, #CBD5E1)'
                                : `linear-gradient(135deg, ${row.color_hex}33, ${row.color_hex}66)`,
                            color: isChampion || isRunnerUp ? '#0f0c29' : '#F8FAFC',
                            boxShadow: isChampion ? '0 0 12px rgba(250,204,21,0.5)' : undefined,
                          }}
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
                            style={{ background: row.color_hex + '44' }}
                          />
                        )}
                      </div>

                      {/* Team name + logo */}
                      <div className="flex items-center gap-3">
                        <Avatar
                          src={row.logo_url}
                          name={row.team_name}
                          size="sm"
                          shape="square"
                          colorHex={row.color_hex}
                        />
                        <div>
                          <span
                            className="text-sm font-display font-bold leading-tight block group-hover:text-pink-400 transition-colors"
                            style={{ color: '#F8FAFC' }}
                          >
                            {row.team_name}
                          </span>
                          {row.nation && (
                            <span className="text-[9px] font-mono" style={{ color: 'rgba(248,250,252,0.4)' }}>
                              {row.nation}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Stats columns */}
                      {[
                        { val: row.mp, color: undefined },
                        { val: row.w, color: '#34D399' },
                        { val: row.d, color: '#94A3B8' },
                        { val: row.l, color: '#F87171' },
                        { val: row.gf, color: undefined },
                        { val: row.gd > 0 ? `+${row.gd}` : row.gd, color: row.gd > 0 ? '#22D3EE' : row.gd < 0 ? '#F87171' : undefined },
                      ].map((cell, i) => (
                        <div key={i} className="text-center">
                          <span
                            className="text-sm font-mono font-bold"
                            style={{ color: cell.color || 'rgba(248,250,252,0.85)' }}
                          >
                            {cell.val}
                          </span>
                        </div>
                      ))}

                      {/* PTS — highlighted like poster */}
                      <div
                        className="flex justify-center items-center"
                      >
                        <span
                          className="px-2.5 py-1 rounded-lg text-sm font-extrabold font-display"
                          style={{
                            background: isChampion
                              ? 'linear-gradient(135deg, #F59E0B, #FACC15)'
                              : 'rgba(236,72,153,0.2)',
                            color: isChampion ? '#0f0c29' : '#EC4899',
                            boxShadow: isChampion ? '0 0 15px rgba(250,204,21,0.4)' : undefined,
                          }}
                        >
                          {row.pts}
                        </span>
                      </div>

                      {/* Form badges */}
                      <div className="flex items-center gap-1 justify-center flex-wrap">
                        {form.length === 0 ? (
                          <span className="text-[10px] font-mono" style={{ color: 'rgba(248,250,252,0.2)' }}>—</span>
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
        )}

        {/* Bottom footer strip inside card */}
        <div
          className="px-6 py-3 flex items-center justify-between border-t"
          style={{ borderColor: 'rgba(255,255,255,0.06)' }}
        >
          <div className="flex items-center gap-4 text-[10px] font-mono" style={{ color: 'rgba(248,250,252,0.35)' }}>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-emerald-500" /> Win
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-slate-500" /> Draw
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-rose-600" /> Loss
            </span>
          </div>
          <span className="text-[10px] font-mono" style={{ color: 'rgba(248,250,252,0.2)' }}>
            Auto-sorted · Computed from match events
          </span>
        </div>
      </div>
    </div>
  );
};
