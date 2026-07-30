'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { db, Tournament, Team, SportProfile, StandingsRow, Profile } from '../utils/db';
import { supabase } from '../utils/supabaseClient';
import { Auth } from '../components/Auth';
import { TournamentWizard } from '../components/TournamentWizard';
import { Registration } from '../components/Registration';
import { Fixtures } from '../components/Fixtures';
import { PointsTable } from '../components/PointsTable';
import { MatchCenter } from '../components/MatchCenter';
import { AdminManagement } from '../components/AdminManagement';
import { generateRoundRobinFixtures, generateKnockoutRound1 } from '../utils/formatEngine';
import {
  Trophy, Calendar, Users, ShieldAlert, Award, RefreshCw,
  Zap, Shield, Plus, ChevronDown, Sparkles, Clock
} from 'lucide-react';
import { Avatar } from '../components/Avatar';
import Link from 'next/link';

export default function HomePage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [activeTournament, setActiveTournament] = useState<Tournament | null>(null);
  const [sportProfiles, setSportProfiles] = useState<SportProfile[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [activeTab, setActiveTab] = useState<'standings' | 'fixtures' | 'registry' | 'admins'>('registry');
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [showTournamentDropdown, setShowTournamentDropdown] = useState(false);

  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [loading, setLoading] = useState(true);

  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const [champion, setChampion] = useState<StandingsRow | null>(null);

  const triggerRefresh = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);

  const loadData = useCallback(async (keepTournamentId?: string) => {
    setLoading(true);
    try {
      const profiles = await db.getSportProfiles();
      setSportProfiles(profiles);

      const allTournaments = await db.getTournaments();
      setTournaments(allTournaments);

      if (allTournaments.length > 0) {
        // Prefer the currently selected tournament, otherwise take the latest
        const target = keepTournamentId
          ? allTournaments.find(t => t.id === keepTournamentId) || allTournaments[0]
          : allTournaments[0];

        setActiveTournament(target);

        // Only get accepted teams for the main display/fixtures/standings
        const registeredTeams = await db.getTeams(target.id, 'accepted');
        setTeams(registeredTeams);

        if (target.status === 'active') {
          setActiveTab('fixtures');
        } else if (target.status === 'completed') {
          setActiveTab('standings');
          const standings = await db.getStandings(target.id);
          if (standings.length > 0) {
            setChampion(standings[0]);
          }
        }
      } else {
        setActiveTournament(null);
      }
    } catch (err) {
      console.error('Error loading homepage data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        db.getProfile(session.user.id).then(p => setProfile(p));
      } else {
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        db.getProfile(session.user.id).then(p => setProfile(p));
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) {
      loadData(activeTournament?.id);
    }
  }, [loadData, refreshTrigger, session]);

  const handleTournamentCreated = (tournament: Tournament) => {
    setShowWizard(false);
    setActiveTournament(tournament);
    setTeams([]);
    setActiveTab('registry');
    setChampion(null);
    triggerRefresh();
  };

  const handleSelectTournament = async (t: Tournament) => {
    setShowTournamentDropdown(false);
    setActiveTournament(t);
    setSelectedMatchId(null);
    setChampion(null);
    setActiveTab(t.status === 'active' ? 'fixtures' : t.status === 'completed' ? 'standings' : 'registry');

    const accepted = await db.getTeams(t.id, 'accepted');
    setTeams(accepted);

    if (t.status === 'completed') {
      const standings = await db.getStandings(t.id);
      if (standings.length > 0) setChampion(standings[0]);
    }
  };

  const reloadTeams = async () => {
    if (!activeTournament) return;
    try {
      const freshTeams = await db.getTeams(activeTournament.id, 'accepted');
      setTeams(freshTeams);
    } catch (err) {
      console.error('Error reloading teams:', err);
    }
  };

  const handleActivateTournament = async () => {
    if (!activeTournament || teams.length < 2) return;

    try {
      // Always clear existing fixtures first — makes this call idempotent.
      // Cascade on the DB wipes match_events automatically; offline fallback does it too.
      await db.clearMatches(activeTournament.id);

      let generatedMatches: any[] = [];
      if (activeTournament.format === 'league') {
        generatedMatches = generateRoundRobinFixtures(activeTournament.id, teams, false);
      } else if (activeTournament.format === 'knockout') {
        const teamCount = teams.length;
        let size: 2 | 4 | 8 | 16 = 2;
        if (teamCount > 8) size = 16;
        else if (teamCount > 4) size = 8;
        else if (teamCount > 2) size = 4;
        generatedMatches = generateKnockoutRound1(activeTournament.id, teams, size);
      }

      if (generatedMatches.length > 0) {
        await db.createMatches(generatedMatches);
        await db.updateTournamentStatus(activeTournament.id, 'active');
        setActiveTab('fixtures');
        triggerRefresh();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // ADMIN ONLY — Delete the current tournament (and all its data)
  const handleDeleteTournament = async () => {
    if (profile?.role !== 'admin') return;
    if (!activeTournament) return;
    if (!confirm(`DELETE "${activeTournament.name}"? This will permanently remove all its teams, players, matches and events. This cannot be undone.`)) return;
    try {
      await db.deleteTournament(activeTournament.id);
      setActiveTournament(null);
      setTeams([]);
      setSelectedMatchId(null);
      setChampion(null);
      setActiveTab('registry');
      triggerRefresh();
    } catch (err) {
      console.error(err);
      alert(`Failed to delete tournament: ${(err as Error).message}`);
    }
  };

  // ADMIN ONLY — Restart the current tournament:
  // Clears all matches + events (cascade), resets status to 'draft'.
  // Teams and rosters are completely untouched — no re-registration needed.
  const handleRestartTournament = async () => {
    if (profile?.role !== 'admin') return;
    if (!activeTournament) return;
    if (
      !confirm(
        `RESTART "${activeTournament.name}"?\n\n` +
        `This will DELETE all matches and match events for this tournament and ` +
        `reset its status back to Draft so you can regenerate fixtures.\n\n` +
        `Teams and player rosters are NOT affected — no re-registration required.\n\n` +
        `This cannot be undone.`
      )
    ) return;
    try {
      await db.restartTournament(activeTournament.id);
      // Reflect the status change locally without a full page reload
      setActiveTournament(prev => prev ? { ...prev, status: 'draft' } : null);
      setSelectedMatchId(null);
      setChampion(null);
      setActiveTab('registry');
      triggerRefresh();
    } catch (err) {
      console.error(err);
      alert(`Failed to restart tournament: ${(err as Error).message}`);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-background text-foreground font-mono">
        <Zap className="w-10 h-10 text-accent-gold animate-bounce mb-4" />
        <span>SYNCING THE OMNIVERSE FIELD STATE...</span>
      </div>
    );
  }

  const supabaseConnected = db.isSupabaseConfigured();
  const isAdmin = profile?.role === 'admin';

  return (
    <div className="flex-1 flex flex-col">
      {/* Universal Sticky Topbar */}
      <header className="border-b border-white/5 bg-surface/50 backdrop-blur-md sticky top-0 z-50 px-4 sm:px-6 py-3 flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Left: Logo + Title */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="p-2 bg-gradient-to-tr from-accent-gold to-yellow-400 text-background rounded-lg shadow-md">
            <Trophy className="w-5 h-5 font-bold" />
          </div>
          <div>
            <h1 className="font-display font-bold tracking-wider text-sm sm:text-base text-foreground uppercase">
              The Tournament of Power
            </h1>
            <p className="text-[10px] text-nebula-gray tracking-wide">MULTIVERSE CHAMPIONSHIP MANAGEMENT</p>
          </div>
        </div>

        {/* Centre: Tournament Selector (only when signed in and tournaments exist) */}
        {session && tournaments.length > 0 && (
          <div className="relative flex-1 flex justify-center max-w-xs">
            <button
              onClick={() => setShowTournamentDropdown(v => !v)}
              className="flex items-center gap-2 px-4 py-2 bg-surface border border-white/10 hover:border-white/20 rounded-xl text-sm font-bold text-foreground transition-all w-full justify-between"
            >
              <div className="flex items-center gap-2 truncate">
                <Trophy className="w-4 h-4 text-accent-gold shrink-0" />
                <span className="truncate">{activeTournament?.name || 'Select Tournament'}</span>
              </div>
              <ChevronDown className={`w-4 h-4 text-nebula-gray shrink-0 transition-transform ${showTournamentDropdown ? 'rotate-180' : ''}`} />
            </button>
            {showTournamentDropdown && (
              <div className="absolute top-full mt-2 w-full bg-surface border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50">
                {tournaments.map(t => (
                  <button
                    key={t.id}
                    onClick={() => handleSelectTournament(t)}
                    className={`w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-left hover:bg-white/5 transition-colors ${activeTournament?.id === t.id ? 'text-accent-gold bg-accent-gold/5' : 'text-foreground'}`}
                  >
                    <span className="truncate">{t.name}</span>
                    <span className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded ml-2 shrink-0 ${
                      t.status === 'active' ? 'bg-success/20 text-success' :
                      t.status === 'completed' ? 'bg-white/10 text-nebula-gray' :
                      'bg-accent-gold/10 text-accent-gold'
                    }`}>{t.status}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Right: User Info & Controls */}
        <div className="flex items-center gap-3 shrink-0">
          {session && (
            <div className="flex items-center gap-3 mr-2 border-r border-white/10 pr-3">
              <div className="text-right hidden sm:block">
                <div className="text-xs font-bold text-slate-200">{session.user.email}</div>
                <div className="text-[10px] uppercase font-bold text-amber-500">{profile?.role || 'User'}</div>
              </div>
              <button
                onClick={() => supabase.auth.signOut()}
                className="px-3 py-1.5 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
              >
                Sign Out
              </button>
            </div>
          )}

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${supabaseConnected ? 'bg-success animate-pulse' : 'bg-amber-500'}`} />
              <span className="text-[9px] font-mono text-nebula-gray uppercase hidden sm:block">
                {supabaseConnected ? 'Supabase' : 'Local'}
              </span>
            </div>

            {/* Pending Approvals — Admins only */}
            {isAdmin && session && (
              <Link
                href="/admin/approvals"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 hover:border-amber-500/50 rounded-xl text-xs font-bold transition-all"
              >
                <Clock className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Pending Approvals</span>
              </Link>
            )}

            {/* Create Tournament — Admins only */}
            {isAdmin && session && (
              <button
                onClick={() => setShowWizard(v => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-gold/10 hover:bg-accent-gold/20 text-accent-gold border border-accent-gold/20 hover:border-accent-gold/50 rounded-xl text-xs font-bold transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">New Tournament</span>
              </button>
            )}

            {/* Delete Tournament — ADMIN ONLY */}
            {isAdmin && activeTournament && (
              <button
                onClick={handleDeleteTournament}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-error/20 bg-error/5 hover:bg-error/10 text-error hover:border-error rounded-xl text-xs font-bold transition-all"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Delete Tournament</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Body content */}
      {!session ? (
        <Auth onAuthSuccess={() => loadData()} />
      ) : showWizard ? (
        <div className="flex-1 flex items-center justify-center p-6 md:p-8">
          <div className="w-full max-w-4xl">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Sparkles className="w-5 h-5 text-accent-gold" />
                <h2 className="text-lg font-display font-bold text-foreground">Create New Tournament</h2>
              </div>
              <button
                onClick={() => setShowWizard(false)}
                className="text-xs text-nebula-gray hover:text-foreground px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/20 transition-all"
              >
                Cancel
              </button>
            </div>
            <TournamentWizard onComplete={handleTournamentCreated} sportProfiles={sportProfiles} />
          </div>
        </div>
      ) : (
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-8 flex flex-col justify-start">
          {!activeTournament ? (
            <div className="flex-1 flex items-center justify-center py-12">
              {isAdmin ? (
                <div className="text-center space-y-4">
                  <div className="w-20 h-20 mx-auto rounded-3xl bg-accent-gold/10 border border-accent-gold/20 flex items-center justify-center">
                    <Trophy className="w-10 h-10 text-accent-gold" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-300">No Tournaments Yet</h3>
                  <p className="text-slate-500 text-sm">Click "New Tournament" in the top bar to get started.</p>
                </div>
              ) : (
                <div className="text-center p-8 bg-surface rounded-3xl border border-white/5">
                  <h3 className="text-xl font-bold text-slate-300 mb-2">No Active Tournament</h3>
                  <p className="text-slate-500">Please wait for the administrator to start a tournament.</p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-8">
              {/* Champion Celebration Banner */}
              {activeTournament.status === 'completed' && champion && (
                <div className="bg-gradient-to-r from-accent-gold/10 via-yellow-500/5 to-transparent border-2 border-accent-gold/30 rounded-3xl p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-[0_0_30px_rgba(250,204,21,0.05)]">
                  <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-accent-gold text-background rounded-2xl flex items-center justify-center text-4xl shadow-lg border border-accent-gold">
                      🏆
                    </div>
                    <div>
                      <span className="text-xs uppercase font-extrabold tracking-widest text-accent-gold font-mono">
                        Tournament Complete
                      </span>
                      <h2 className="text-2xl font-display font-extrabold text-foreground mt-1">
                        {champion.team_name} wins the Championship!
                      </h2>
                      <p className="text-xs text-nebula-gray mt-0.5">
                        {champion.pts} Points · Goal Diff {champion.gd > 0 ? `+${champion.gd}` : champion.gd}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Avatar src={champion.logo_url} name={champion.team_name} size="lg" shape="square" colorHex={champion.color_hex} />
                  </div>
                </div>
              )}

              {/* Active tournament tab area */}
              {selectedMatchId ? (
                <MatchCenter
                  matchId={selectedMatchId}
                  onBack={() => {
                    setSelectedMatchId(null);
                    triggerRefresh();
                  }}
                  onMatchUpdated={triggerRefresh}
                  isAdmin={isAdmin}
                />
              ) : (
                <div className="space-y-6">
                  {/* Tabs bar */}
                  <div className="flex border-b border-white/5 pb-0.5 items-center justify-between gap-2 overflow-x-auto">
                    <div className="flex gap-4 sm:gap-6 shrink-0">
                      <button
                        onClick={() => setActiveTab('registry')}
                        className={`pb-4 text-xs sm:text-sm font-display font-bold border-b-2 uppercase tracking-wider transition-all flex items-center gap-2 whitespace-nowrap ${
                          activeTab === 'registry' ? 'border-accent-gold text-accent-gold' : 'border-transparent text-nebula-gray hover:text-foreground'
                        }`}
                      >
                        <Users className="w-4 h-4" /> Registry
                      </button>
                      <button
                        onClick={() => setActiveTab('fixtures')}
                        className={`pb-4 text-xs sm:text-sm font-display font-bold border-b-2 uppercase tracking-wider transition-all flex items-center gap-2 whitespace-nowrap ${
                          activeTab === 'fixtures' ? 'border-accent-gold text-accent-gold' : 'border-transparent text-nebula-gray hover:text-foreground'
                        }`}
                      >
                        <Calendar className="w-4 h-4" /> Fixtures
                      </button>
                      <button
                        onClick={() => setActiveTab('standings')}
                        className={`pb-4 text-xs sm:text-sm font-display font-bold border-b-2 uppercase tracking-wider transition-all flex items-center gap-2 whitespace-nowrap ${
                          activeTab === 'standings' ? 'border-accent-gold text-accent-gold' : 'border-transparent text-nebula-gray hover:text-foreground'
                        }`}
                      >
                        <Trophy className="w-4 h-4" /> Leaderboard
                      </button>
                      {isAdmin && (
                        <button
                          onClick={() => setActiveTab('admins')}
                          className={`pb-4 text-xs sm:text-sm font-display font-bold border-b-2 uppercase tracking-wider transition-all flex items-center gap-2 whitespace-nowrap ${
                            activeTab === 'admins' ? 'border-accent-gold text-accent-gold' : 'border-transparent text-nebula-gray hover:text-foreground'
                          }`}
                        >
                          <Shield className="w-4 h-4" /> Admin Panel
                        </button>
                      )}
                    </div>

                    <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-surface rounded-xl border border-white/5 shrink-0">
                      <span className="text-[10px] uppercase font-bold text-nebula-gray">FORMAT:</span>
                      <span className="text-[10px] uppercase font-extrabold text-foreground bg-white/5 px-2 py-0.5 rounded font-mono">
                        {activeTournament.format}
                      </span>
                    </div>
                  </div>

                  {/* Tab content renders */}
                  {activeTab === 'registry' && (
                    <Registration
                      tournament={activeTournament}
                      onActiveTrigger={handleActivateTournament}
                      onRestartTrigger={isAdmin ? handleRestartTournament : undefined}
                      onTeamsUpdated={reloadTeams}
                      isAdmin={isAdmin}
                      session={session}
                    />
                  )}

                  {activeTab === 'fixtures' && (
                    <Fixtures
                      tournament={activeTournament}
                      teams={teams}
                      onSelectMatch={setSelectedMatchId}
                      refreshTrigger={refreshTrigger}
                      isAdmin={isAdmin}
                      onRefresh={triggerRefresh}
                    />
                  )}

                  {activeTab === 'standings' && (
                    <PointsTable key={activeTournament.id} tournament={activeTournament} refreshTrigger={refreshTrigger} />
                  )}

                  {activeTab === 'admins' && isAdmin && (
                    <div className="py-8">
                      <AdminManagement currentUserId={session?.user?.id} />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </main>
      )}

      {/* Click-outside to close dropdown */}
      {showTournamentDropdown && (
        <div className="fixed inset-0 z-40" onClick={() => setShowTournamentDropdown(false)} />
      )}
    </div>
  );
}
