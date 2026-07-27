'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { db, Match, Team, Player, MatchEvent, SportProfile } from '../utils/db';
import { Avatar } from './Avatar';
import { checkAndGenerateNextKnockoutRound } from '../utils/formatEngine';
import { Trophy, Clock, Trash2, ShieldAlert, Award, Play, CheckCircle, RefreshCcw, Save } from 'lucide-react';

interface MatchCenterProps {
  matchId: string;
  onBack: () => void;
  onMatchUpdated: () => void;
  isAdmin?: boolean;
}

export const MatchCenter: React.FC<MatchCenterProps> = ({ matchId, onBack, onMatchUpdated, isAdmin }) => {
  const [match, setMatch] = useState<Match | null>(null);
  const [teamA, setTeamA] = useState<Team | null>(null);
  const [teamB, setTeamB] = useState<Team | null>(null);
  const [playersA, setPlayersA] = useState<Player[]>([]);
  const [playersB, setPlayersB] = useState<Player[]>([]);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [sportProfile, setSportProfile] = useState<SportProfile | null>(null);

  // Admin Logger Form state
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [eventType, setEventType] = useState('');
  const [minute, setMinute] = useState(45);
  const [eventValue, setEventValue] = useState(''); // for custom values like possession percentage or shot count
  const [loading, setLoading] = useState(true);

  // Shootout state for knockout draws
  const [shootoutTeamAScore, setShootoutTeamAScore] = useState(0);
  const [shootoutTeamBScore, setShootoutTeamBScore] = useState(0);
  const [showShootoutForm, setShowShootoutForm] = useState(false);

  // Direct Score Entry state
  const [directScoreA, setDirectScoreA] = useState(0);
  const [directScoreB, setDirectScoreB] = useState(0);
  const [directScoreSaving, setDirectScoreSaving] = useState(false);

  const loadMatchData = useCallback(async () => {
    setLoading(true);
    try {
      const matchData = await db.getMatch(matchId);
      if (!matchData) {
        onBack();
        return;
      }
      setMatch(matchData);
      setDirectScoreA(matchData.team_a_score ?? 0);
      setDirectScoreB(matchData.team_b_score ?? 0);

      // Load teams
      const teams = await db.getTeams(matchData.tournament_id);
      const tA = teams.find((t) => t.id === matchData.team_a_id) || null;
      const tB = teams.find((t) => t.id === matchData.team_b_id) || null;
      setTeamA(tA);
      setTeamB(tB);

      // Default logging team selection
      if (tA && !selectedTeamId) {
        setSelectedTeamId(tA.id);
      }

      // Load players
      if (tA) {
        const pA = await db.getPlayers(tA.id);
        setPlayersA(pA);
      }
      if (tB) {
        const pB = await db.getPlayers(tB.id);
        setPlayersB(pB);
      }

      // Load match events
      const eventList = await db.getMatchEvents(matchId);
      setEvents(eventList);

      // Load active sport profile
      const tourney = await db.getTournament(matchData.tournament_id);
      if (tourney) {
        const profiles = await db.getSportProfiles();
        const activeProfile = profiles.find((p) => p.sport_type === tourney.sport_type) || null;
        setSportProfile(activeProfile);

        if (activeProfile && !eventType) {
          // Set default event type
          const firstEventKey = Object.keys(activeProfile.event_type_config_jsonb.events)[0] || '';
          setEventType(firstEventKey);
        }
      }

      // Initialize shootout scores if present
      if (matchData.metadata_jsonb?.shootout) {
        setShootoutTeamAScore(matchData.metadata_jsonb.shootout.team_a || 0);
        setShootoutTeamBScore(matchData.metadata_jsonb.shootout.team_b || 0);
        setShowShootoutForm(true);
      }
    } catch (err) {
      console.error('Error loading match details:', err);
    } finally {
      setLoading(false);
    }
  }, [matchId, selectedTeamId, eventType, onBack]);

  useEffect(() => {
    loadMatchData();
  }, [loadMatchData]);

  // Clean list of players based on selected team in logging panel
  const currentLoggingPlayers = selectedTeamId === match?.team_a_id ? playersA : playersB;

  useEffect(() => {
    if (currentLoggingPlayers.length > 0) {
      setSelectedPlayerId(currentLoggingPlayers[0].id);
    } else {
      setSelectedPlayerId('');
    }
  }, [selectedTeamId, currentLoggingPlayers]);

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!match || !eventType) return;

    try {
      const eventConfig = sportProfile?.event_type_config_jsonb.events[eventType];
      const requiresPlayer = eventConfig?.requires_player ?? true;

      await db.addMatchEvent({
        match_id: match.id,
        player_id: requiresPlayer ? selectedPlayerId || undefined : undefined,
        team_id: selectedTeamId || undefined,
        event_type: eventType,
        minute: minute,
        metadata_jsonb: eventValue ? { value: eventValue } : {},
      });

      // Reset form states but keep selection
      setEventValue('');
      loadMatchData();
      onMatchUpdated();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!confirm('Are you sure you want to delete this event?')) return;
    try {
      await db.deleteMatchEvent(eventId);
      loadMatchData();
      onMatchUpdated();
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateStatus = async (status: Match['status']) => {
    if (!match) return;

    // Handle shootout checks for knockout draw completions
    if (status === 'completed' && match.team_a_score === match.team_b_score) {
      const isKnockout = match.round_name.toLowerCase().includes('final') || 
                         match.round_name.toLowerCase().includes('semi') || 
                         match.round_name.toLowerCase().includes('quarter') ||
                         match.round_name.toLowerCase().includes('round of');
      
      if (isKnockout && !showShootoutForm) {
        alert('Knockout match ends in a draw! Please enter Penalty Shootout scores to resolve.');
        setShowShootoutForm(true);
        return;
      }
    }

    try {
      // Save shootout metadata if applicable
      if (showShootoutForm) {
        if (shootoutTeamAScore === shootoutTeamBScore) {
          alert('Penalty shootout cannot end in a draw.');
          return;
        }
        
        // Update metadata
        const metadata = {
          ...match.metadata_jsonb,
          shootout: {
            team_a: shootoutTeamAScore,
            team_b: shootoutTeamBScore,
            winner: shootoutTeamAScore > shootoutTeamBScore ? match.team_a_id : match.team_b_id
          }
        };
        // Update match directly
        if (db.isSupabaseConfigured()) {
          const { supabase } = await import('../utils/supabaseClient');
          await supabase.from('matches').update({ status, metadata_jsonb: metadata }).eq('id', match.id);
        } else {
          const matches = JSON.parse(localStorage.getItem('top_matches') || '[]');
          const idx = matches.findIndex((x: any) => x.id === match.id);
          if (idx !== -1) {
            matches[idx].status = status;
            matches[idx].metadata_jsonb = metadata;
            localStorage.setItem('top_matches', JSON.stringify(matches));
          }
        }
      } else {
        await db.updateMatchStatus(match.id, status);
      }

      // Check format progression for next round
      await checkAndGenerateNextKnockoutRound(match.tournament_id);

      loadMatchData();
      onMatchUpdated();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveDirectScore = async () => {
    if (!match || !teamA || !teamB) return;
    setDirectScoreSaving(true);
    try {
      // 1. Delete existing goal events
      const existingEvents = await db.getMatchEvents(match.id);
      const goalEvents = existingEvents.filter(
        (ev) => ev.event_type === 'goal' || ev.event_type === 'own_goal'
      );
      await Promise.all(goalEvents.map((ev) => db.deleteMatchEvent(ev.id)));

      // 2. Insert new goals
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

      await addGoals(teamA.id, directScoreA);
      await addGoals(teamB.id, directScoreB);

      // If scheduled, move it to in_progress
      if (match.status === 'scheduled') {
        await db.updateMatchStatus(match.id, 'in_progress');
      }

      await loadMatchData();
      onMatchUpdated();
      alert('Scoreboard updated successfully!');
    } catch (err) {
      console.error('Error saving direct score:', err);
    } finally {
      setDirectScoreSaving(false);
    }
  };

  const handleResetMatch = async () => {
    if (!match || !confirm('Resetting will delete ALL logged events and score points. Proceed?')) return;
    try {
      const matchEvents = await db.getMatchEvents(match.id);
      await Promise.all(matchEvents.map(e => db.deleteMatchEvent(e.id)));
      await db.updateMatchStatus(match.id, 'scheduled');
      
      // Clear shootout metadata
      if (db.isSupabaseConfigured()) {
        const { supabase } = await import('../utils/supabaseClient');
        await supabase.from('matches').update({ metadata_jsonb: {} }).eq('id', match.id);
      } else {
        const matches = JSON.parse(localStorage.getItem('top_matches') || '[]');
        const idx = matches.findIndex((x: any) => x.id === match.id);
        if (idx !== -1) {
          matches[idx].metadata_jsonb = {};
          localStorage.setItem('top_matches', JSON.stringify(matches));
        }
      }

      setShowShootoutForm(false);
      loadMatchData();
      onMatchUpdated();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return <div className="h-64 flex items-center justify-center text-sm font-mono text-nebula-gray">[SYNCING MATCH CENTER...]</div>;
  }

  if (!match || !teamA || !teamB) return null;

  // Group goal events to list below scores
  const goalsA = events.filter(e => e.team_id === teamA.id && (e.event_type === 'goal' || e.event_type === 'own_goal'));
  const goalsB = events.filter(e => e.team_id === teamB.id && (e.event_type === 'goal' || e.event_type === 'own_goal'));

  const getPlayerName = (playerId?: string) => {
    if (!playerId) return 'Anonymous';
    const player = [...playersA, ...playersB].find(p => p.id === playerId);
    return player ? player.name : 'Unknown Player';
  };

  const getEventName = (type: string) => {
    return sportProfile?.event_type_config_jsonb.events[type]?.label || type;
  };

  return (
    <div className="w-full space-y-8">
      {/* Back to Fixtures header */}
      <div className="flex justify-between items-center">
        <button
          onClick={onBack}
          className="px-4 py-2 border border-white/5 bg-surface hover:bg-surface-hover rounded-xl text-xs font-semibold text-foreground transition-all"
        >
          &larr; Back to Bracket & Fixtures
        </button>
        <span className="text-[10px] text-nebula-gray font-mono font-bold">MATCH REFERENCE: #{match.id.substring(0, 8).toUpperCase()}</span>
      </div>

      {/* Main Score Monolith Display */}
      <div className="bg-gradient-to-b from-surface/80 to-surface/20 border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
        <div className="p-8 flex flex-col items-center">
          <span className="text-xs bg-white/5 border border-white/10 px-3 py-1 rounded-full font-mono text-nebula-gray font-bold uppercase tracking-widest mb-6">
            {match.round_name} • {match.status === 'completed' ? 'Final Score' : match.status === 'in_progress' ? 'LIVE NOW' : 'Pre-Match'}
          </span>

          <div className="grid grid-cols-7 items-center justify-center w-full max-w-3xl gap-4">
            {/* Team A block */}
            <div className="col-span-3 flex flex-col items-center text-center">
              <Avatar src={teamA.logo_url} name={teamA.name} size="xl" shape="square" colorHex={teamA.color_hex} />
              <h2 className="font-display font-bold text-lg sm:text-xl text-foreground mt-4">{teamA.name}</h2>
              <div className="w-12 h-1.5 rounded-full mt-2" style={{ backgroundColor: teamA.color_hex }} />
            </div>

            {/* Score Monolith numbers */}
            <div className="col-span-1 flex flex-col items-center justify-center">
              {match.status === 'scheduled' ? (
                <div className="text-sm text-nebula-gray font-display font-extrabold tracking-widest uppercase bg-white/5 border border-white/10 px-4 py-2.5 rounded-2xl">
                  VS
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <div className="flex items-center gap-2 font-mono text-3xl sm:text-5xl font-extrabold bg-background border border-white/5 px-6 py-4 rounded-3xl text-foreground shadow-inner">
                    <span className={match.team_a_score! > match.team_b_score! ? 'text-accent-gold' : ''}>{match.team_a_score}</span>
                    <span className="text-white/20">:</span>
                    <span className={match.team_b_score! > match.team_a_score! ? 'text-accent-gold' : ''}>{match.team_b_score}</span>
                  </div>
                  {/* Shootout score layout */}
                  {match.metadata_jsonb?.shootout && (
                    <span className="text-[10px] text-accent-cyan font-bold tracking-widest font-mono mt-2 bg-accent-cyan/10 border border-accent-cyan/20 px-2.5 py-0.5 rounded">
                      PEN ({match.metadata_jsonb.shootout.team_a} - {match.metadata_jsonb.shootout.team_b})
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Team B block */}
            <div className="col-span-3 flex flex-col items-center text-center">
              <Avatar src={teamB.logo_url} name={teamB.name} size="xl" shape="square" colorHex={teamB.color_hex} />
              <h2 className="font-display font-bold text-lg sm:text-xl text-foreground mt-4">{teamB.name}</h2>
              <div className="w-12 h-1.5 rounded-full mt-2" style={{ backgroundColor: teamB.color_hex }} />
            </div>
          </div>

          {/* Goal Scorer timelines under scoreboard */}
          {match.status !== 'scheduled' && (
            <div className="grid grid-cols-2 w-full max-w-2xl gap-8 mt-8 border-t border-white/5 pt-6 text-xs font-mono">
              {/* Scorers A */}
              <div className="text-right space-y-2.5 border-r border-white/5 pr-6">
                {goalsA.map((e) => (
                  <div key={e.id} className="flex justify-end items-center gap-2">
                    <span className="text-nebula-gray">{e.minute}&apos;</span>
                    <span className={e.event_type === 'own_goal' ? 'text-rose-400 font-semibold' : 'text-foreground'}>
                      {getPlayerName(e.player_id)} {e.event_type === 'own_goal' && '(OG)'}
                    </span>
                  </div>
                ))}
                {goalsA.length === 0 && <span className="text-nebula-gray/40 italic block text-xs">No scorers logged</span>}
              </div>

              {/* Scorers B */}
              <div className="text-left space-y-2.5 pl-6">
                {goalsB.map((e) => (
                  <div key={e.id} className="flex justify-start items-center gap-2">
                    <span className={e.event_type === 'own_goal' ? 'text-rose-400 font-semibold' : 'text-foreground'}>
                      {getPlayerName(e.player_id)} {e.event_type === 'own_goal' && '(OG)'}
                    </span>
                    <span className="text-nebula-gray">{e.minute}&apos;</span>
                  </div>
                ))}
                {goalsB.length === 0 && <span className="text-nebula-gray/40 italic block text-xs">No scorers logged</span>}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className={`grid grid-cols-1 ${isAdmin ? 'lg:grid-cols-3' : 'lg:grid-cols-2 lg:max-w-4xl mx-auto'} gap-8`}>
        {/* Organizer Panel / Match Admin */}
        {isAdmin && (
          <div className="bg-surface/50 border border-white/5 rounded-3xl p-6 h-fit space-y-6">
            <div className="flex justify-between items-center border-b border-white/5 pb-3">
              <h3 className="font-display font-bold text-sm text-accent-gold uppercase tracking-wider flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-accent-gold" /> Organizer Controls
              </h3>
              <span className="px-2 py-0.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[9px] uppercase font-bold tracking-widest rounded font-mono">
                Admin
              </span>
            </div>

            {/* Quick status controller */}
            <div className="space-y-3">
              <label className="block text-[10px] uppercase tracking-wider text-nebula-gray font-bold">Match Status</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => handleUpdateStatus('scheduled')}
                  disabled={match.status === 'scheduled'}
                  className={`py-2 text-center text-xs font-bold rounded-lg transition-all ${
                    match.status === 'scheduled' ? 'bg-white/10 text-white cursor-not-allowed' : 'bg-surface hover:bg-surface-hover text-slate-300'
                  }`}
                >
                  Scheduled
                </button>
                <button
                  onClick={() => handleUpdateStatus('in_progress')}
                  disabled={match.status === 'in_progress'}
                  className={`flex items-center justify-center gap-1 py-2 text-center text-xs font-bold rounded-lg transition-all ${
                    match.status === 'in_progress' ? 'bg-accent-cyan/15 text-accent-cyan cursor-not-allowed' : 'bg-surface hover:bg-surface-hover text-slate-300'
                  }`}
                >
                  <Play className="w-3.5 h-3.5" /> Start
                </button>
                <button
                  onClick={() => handleUpdateStatus('completed')}
                  disabled={match.status === 'completed'}
                  className={`flex items-center justify-center gap-1 py-2 text-center text-xs font-bold rounded-lg transition-all ${
                    match.status === 'completed' ? 'bg-success/15 text-success cursor-not-allowed' : 'bg-surface hover:bg-surface-hover text-slate-300'
                  }`}
                >
                  <CheckCircle className="w-3.5 h-3.5" /> End
                </button>
              </div>
            </div>

            {/* Quick Score Overrides */}
            <div className="space-y-3 pt-3 border-t border-white/5">
              <label className="block text-[10px] uppercase tracking-wider text-nebula-gray font-bold">Direct Score Board</label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] uppercase text-nebula-gray font-bold mb-1 line-clamp-1">{teamA.name}</label>
                  <input
                    type="number"
                    min={0}
                    max={99}
                    value={directScoreA}
                    onChange={(e) => setDirectScoreA(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full bg-background border border-white/5 rounded-lg px-3 py-2 text-xs text-foreground outline-none font-mono text-center"
                  />
                </div>
                <div>
                  <label className="block text-[9px] uppercase text-nebula-gray font-bold mb-1 line-clamp-1">{teamB.name}</label>
                  <input
                    type="number"
                    min={0}
                    max={99}
                    value={directScoreB}
                    onChange={(e) => setDirectScoreB(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full bg-background border border-white/5 rounded-lg px-3 py-2 text-xs text-foreground outline-none font-mono text-center"
                  />
                </div>
              </div>
              <button
                onClick={handleSaveDirectScore}
                disabled={directScoreSaving}
                className="w-full py-2.5 bg-accent-gold hover:bg-yellow-400 text-background rounded-lg text-xs font-bold transition-all shadow-[0_0_10px_rgba(250,204,21,0.1)] flex items-center justify-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" /> {directScoreSaving ? 'Saving Score...' : 'Update Scoreboard'}
              </button>
            </div>

            {/* Shootout form if draw and knockout */}
            {showShootoutForm && (
              <div className="p-4 bg-accent-cyan/5 border border-accent-cyan/15 rounded-2xl space-y-4">
                <span className="text-[10px] uppercase font-bold tracking-widest text-accent-cyan font-mono block">
                  [KNOCKOUT RESOLUTION] Penalty Shootout
                </span>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[9px] uppercase text-nebula-gray font-bold mb-1">{teamA.name} Score</label>
                    <input
                      type="number"
                      min={0}
                      value={shootoutTeamAScore}
                      onChange={(e) => setShootoutTeamAScore(parseInt(e.target.value, 10) || 0)}
                      className="w-full bg-background border border-white/5 rounded-lg px-3 py-2 text-sm text-foreground outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] uppercase text-nebula-gray font-bold mb-1">{teamB.name} Score</label>
                    <input
                      type="number"
                      min={0}
                      value={shootoutTeamBScore}
                      onChange={(e) => setShootoutTeamBScore(parseInt(e.target.value, 10) || 0)}
                      className="w-full bg-background border border-white/5 rounded-lg px-3 py-2 text-sm text-foreground outline-none font-mono"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Dynamic Event logger */}
            {match.status !== 'completed' ? (
              <form onSubmit={handleAddEvent} className="space-y-4 pt-3 border-t border-white/5">
                <span className="text-[10px] uppercase font-bold tracking-widest text-nebula-gray block">Log Match Event</span>

                {/* Team select */}
                <div>
                  <label className="block text-[9px] uppercase text-nebula-gray font-bold mb-1">Target Team</label>
                  <select
                    value={selectedTeamId}
                    onChange={(e) => setSelectedTeamId(e.target.value)}
                    className="w-full bg-background border border-white/5 rounded-lg px-3 py-2 text-xs text-foreground outline-none transition-all"
                  >
                    <option value={teamA.id}>{teamA.name}</option>
                    <option value={teamB.id}>{teamB.name}</option>
                  </select>
                </div>

                {/* Event type config-driven select */}
                {sportProfile && (
                  <div>
                    <label className="block text-[9px] uppercase text-nebula-gray font-bold mb-1">Event Type</label>
                    <select
                      value={eventType}
                      onChange={(e) => setEventType(e.target.value)}
                      className="w-full bg-background border border-white/5 rounded-lg px-3 py-2 text-xs text-foreground outline-none transition-all"
                    >
                      {Object.entries(sportProfile.event_type_config_jsonb.events).map(([key, config]) => (
                        <option key={key} value={key}>
                          {config.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Player select - conditionally rendered if event needs player */}
                {(!eventType || sportProfile?.event_type_config_jsonb.events[eventType]?.requires_player !== false) && (
                  <div>
                    <label className="block text-[9px] uppercase text-nebula-gray font-bold mb-1">Involved Player</label>
                    <select
                      value={selectedPlayerId}
                      onChange={(e) => setSelectedPlayerId(e.target.value)}
                      className="w-full bg-background border border-white/5 rounded-lg px-3 py-2 text-xs text-foreground outline-none transition-all"
                    >
                      <option value="">Anonymous / Team-wide</option>
                      {currentLoggingPlayers.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.role.substring(0, 3)})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Custom Value input (percentage/integer) if event type has value type configured */}
                {eventType && sportProfile?.event_type_config_jsonb.events[eventType]?.value_type && (
                  <div>
                    <label className="block text-[9px] uppercase text-nebula-gray font-bold mb-1">
                      Value ({sportProfile.event_type_config_jsonb.events[eventType].value_type})
                    </label>
                    <input
                      type="number"
                      value={eventValue}
                      onChange={(e) => setEventValue(e.target.value)}
                      placeholder={sportProfile.event_type_config_jsonb.events[eventType].value_type === 'percentage' ? 'e.g., 58' : 'e.g., 14'}
                      className="w-full bg-background border border-white/5 rounded-lg px-3 py-2 text-xs text-foreground outline-none font-mono"
                    />
                  </div>
                )}

                {/* Minute */}
                <div>
                  <label className="block text-[9px] uppercase text-nebula-gray font-bold mb-1">Minute</label>
                  <input
                    type="number"
                    min={0}
                    max={120}
                    required
                    value={minute}
                    onChange={(e) => setMinute(parseInt(e.target.value, 10) || 0)}
                    className="w-full bg-background border border-white/5 rounded-lg px-3 py-2 text-xs text-foreground outline-none font-mono"
                  />
                </div>

                <button
                  type="submit"
                  disabled={!eventType || !selectedTeamId}
                  className="w-full py-2.5 bg-accent-cyan hover:bg-cyan-400 text-background rounded-lg text-xs font-bold transition-all shadow-[0_0_10px_rgba(34,211,238,0.1)] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Log Event
                </button>
              </form>
            ) : (
              <div className="p-4 bg-white/5 rounded-2xl text-center text-xs text-nebula-gray border border-white/5">
                Event logging is disabled because the match is marked as COMPLETED.
              </div>
            )}

            {/* Reset button */}
            <button
              onClick={handleResetMatch}
              className="w-full py-2.5 border border-error/20 hover:border-error bg-error/5 hover:bg-error/15 text-error rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5"
            >
              <RefreshCcw className="w-3.5 h-3.5" /> Reset Match Points
            </button>
          </div>
        )}

        {/* Live Timeline logs */}
        <div className={`${isAdmin ? 'lg:col-span-2' : 'lg:col-span-2'} space-y-6`}>
          <div className="flex justify-between items-center">
            <h3 className="font-display font-bold text-lg text-foreground flex items-center gap-2">
              <Clock className="w-5 h-5 text-accent-cyan" /> Match Timeline & Logs ({events.length})
            </h3>
            <span className="text-xs text-nebula-gray font-mono">Chrono order</span>
          </div>

          {events.length === 0 ? (
            <div className="border border-dashed border-white/5 rounded-3xl p-12 text-center text-nebula-gray bg-surface/20">
              <Clock className="w-12 h-12 mx-auto text-white/10 mb-4 animate-pulse" />
              <p className="font-display text-sm font-semibold text-foreground">Waiting for events</p>
              <p className="text-xs text-nebula-gray mt-1">
                Events logged by the organizer will show up here in real-time.
              </p>
            </div>
          ) : (
            <div className="relative border-l-2 border-white/5 ml-3 pl-6 space-y-6 max-h-[500px] overflow-y-auto pr-2">
              {events.map((e) => {
                const eventTeam = e.team_id === teamA.id ? teamA : teamB;
                const isTeamAEvent = e.team_id === teamA.id;
                
                return (
                  <div key={e.id} className="relative group flex items-start gap-4">
                    {/* Ring dot indicator */}
                    <div 
                      className="absolute -left-[31px] top-1.5 w-4 h-4 rounded-full border-2 border-background shadow-md"
                      style={{ backgroundColor: eventTeam.color_hex }}
                    />

                    <div className="bg-surface/30 border border-white/5 rounded-2xl p-4 flex-1 flex items-center justify-between hover:border-white/10 transition-all">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold font-mono text-accent-gold bg-white/5 border border-white/10 px-2 py-0.5 rounded">
                          {e.minute}&apos;
                        </span>
                        
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold text-foreground flex items-center gap-2">
                            {getEventName(e.event_type)}
                            {e.metadata_jsonb?.value && (
                              <span className="text-[10px] text-accent-cyan bg-accent-cyan/10 border border-accent-cyan/20 px-1.5 py-0.2 rounded font-mono">
                                {e.metadata_jsonb.value}
                                {sportProfile?.event_type_config_jsonb.events[e.event_type]?.value_type === 'percentage' ? '%' : ''}
                              </span>
                            )}
                          </span>
                          <span className="text-[10px] text-nebula-gray flex items-center gap-1.5 mt-0.5">
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: eventTeam.color_hex }} />
                            {eventTeam.name}
                            {e.player_id && ` • ${getPlayerName(e.player_id)}`}
                          </span>
                        </div>
                      </div>

                      {match.status !== 'completed' && isAdmin && (
                        <button
                          onClick={() => handleDeleteEvent(e.id)}
                          className="p-2 text-white/20 hover:text-error hover:bg-error/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
