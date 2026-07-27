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
import { Trophy, Calendar, Users, Cpu, ShieldAlert, Award, RefreshCw, Zap, Shield } from 'lucide-react';
import { Avatar } from '../components/Avatar';

export default function HomePage() {
  const [activeTournament, setActiveTournament] = useState<Tournament | null>(null);
  const [sportProfiles, setSportProfiles] = useState<SportProfile[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [activeTab, setActiveTab] = useState<'standings' | 'fixtures' | 'registry' | 'admins'>('registry');
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  
  // Triggers component updates
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [loading, setLoading] = useState(true);

  // Auth State
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  // Champion for completed state
  const [champion, setChampion] = useState<StandingsRow | null>(null);

  const triggerRefresh = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const profiles = await db.getSportProfiles();
      setSportProfiles(profiles);

      const tournaments = await db.getTournaments();
      if (tournaments.length > 0) {
        const active = tournaments[0]; // grab the latest tournament as the active one for this single-tenant session
        setActiveTournament(active);
        
        const registeredTeams = await db.getTeams(active.id);
        setTeams(registeredTeams);

        // If active, default to standings or fixtures instead of registry
        if (active.status === 'active') {
          setActiveTab('fixtures');
        } else if (active.status === 'completed') {
          setActiveTab('standings');
          const standings = await db.getStandings(active.id);
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
      loadData();
    }
  }, [loadData, refreshTrigger, session]);

  const handleTournamentCreated = (tournament: Tournament) => {
    setActiveTournament(tournament);
    setTeams([]);
    setActiveTab('registry');
    triggerRefresh();
  };

  // Reload teams from storage whenever Registration registers a new team/player
  const reloadTeams = async () => {
    if (!activeTournament) return;
    try {
      const freshTeams = await db.getTeams(activeTournament.id);
      setTeams(freshTeams);
    } catch (err) {
      console.error('Error reloading teams:', err);
    }
  };

  const handleActivateTournament = async () => {
    if (!activeTournament || teams.length < 2) return;

    try {
      let generatedMatches: any[] = [];
      if (activeTournament.format === 'league') {
        generatedMatches = generateRoundRobinFixtures(activeTournament.id, teams, false);
      } else if (activeTournament.format === 'knockout') {
        // Find closest power of 2 size for knockout size: 2, 4, 8, 16
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

  const handleResetTournament = async () => {
    if (!confirm('DANGER: This will delete ALL teams, players, and match records. Return to the creation wizard?')) return;
    try {
      if (activeTournament) {
        // Clean local storage or databases
        if (db.isSupabaseConfigured()) {
          const { supabase } = await import('../utils/supabaseClient');
          await supabase.from('tournaments').delete().eq('id', activeTournament.id);
        } else {
          localStorage.removeItem('top_tournaments');
          localStorage.removeItem('top_teams');
          localStorage.removeItem('top_players');
          localStorage.removeItem('top_matches');
          localStorage.removeItem('top_match_events');
        }
      }
      setActiveTournament(null);
      setTeams([]);
      setSelectedMatchId(null);
      setChampion(null);
      setActiveTab('registry');
      triggerRefresh();
    } catch (err) {
      console.error(err);
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

  // Check if Supabase variables are set
  const supabaseConnected = db.isSupabaseConfigured();

  return (
    <div className="flex-1 flex flex-col">
      {/* Universal Sticky Topbar */}
      <header className="border-b border-white/5 bg-surface/50 backdrop-blur-md sticky top-0 z-50 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
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

        {/* User Info & Controls */}
        <div className="flex items-center gap-4">
          {session && (
            <div className="flex items-center gap-3 mr-4 border-r border-white/10 pr-4">
              <div className="text-right">
                <div className="text-sm font-bold text-slate-200">{session.user.email}</div>
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

          {/* Database indicator & controllers */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${supabaseConnected ? 'bg-success animate-pulse' : 'bg-amber-500'}`} />
              <span className="text-[10px] font-mono text-nebula-gray uppercase">
                {supabaseConnected ? 'Supabase Connected' : 'Local Storage Sandbox'}
              </span>
            </div>

            {activeTournament && (
              <button
                onClick={handleResetTournament}
                className="flex items-center gap-1.5 px-3.5 py-2 border border-error/20 bg-error/5 hover:bg-error/10 text-error hover:border-error rounded-xl text-xs font-bold transition-all"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Reset System
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Body content */}
      {!session ? (
        <Auth onAuthSuccess={() => loadData()} />
      ) : (
        <main className="flex-1 max-w-7xl w-full mx-auto p-6 md:p-8 flex flex-col justify-start">
          {!activeTournament ? (
            <div className="flex-1 flex items-center justify-center py-12">
              {profile?.role === 'admin' ? (
                <TournamentWizard onComplete={handleTournamentCreated} sportProfiles={sportProfiles} />
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
                      Fitted with {champion.pts} Points, Goal Diff {champion.gd > 0 ? `+${champion.gd}` : champion.gd}.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Avatar src={champion.logo_url} name={champion.team_name} size="lg" shape="square" colorHex={champion.color_hex} />
                </div>
              </div>
            )}

            {/* Active tournament header / detail block */}
            {selectedMatchId ? (
              <MatchCenter
                matchId={selectedMatchId}
                onBack={() => {
                  setSelectedMatchId(null);
                  triggerRefresh();
                }}
                onMatchUpdated={triggerRefresh}
                isAdmin={profile?.role === 'admin'}
              />
            ) : (
              <div className="space-y-6">
                {/* Tabs bar */}
                <div className="flex border-b border-white/5 pb-0.5 items-center justify-between">
                  <div className="flex gap-6">
                    <button
                      onClick={() => setActiveTab('registry')}
                      className={`pb-4 text-sm font-display font-bold border-b-2 uppercase tracking-wider transition-all flex items-center gap-2 ${
                        activeTab === 'registry' ? 'border-accent-gold text-accent-gold' : 'border-transparent text-nebula-gray hover:text-foreground'
                      }`}
                    >
                      <Users className="w-4 h-4" /> Faction Registry
                    </button>
                    <button
                      onClick={() => setActiveTab('fixtures')}
                      className={`pb-4 text-sm font-display font-bold border-b-2 uppercase tracking-wider transition-all flex items-center gap-2 ${
                        activeTab === 'fixtures' ? 'border-accent-gold text-accent-gold' : 'border-transparent text-nebula-gray hover:text-foreground'
                      }`}
                    >
                      <Calendar className="w-4 h-4" /> Brackets & Fixtures
                    </button>
                    <button
                      onClick={() => setActiveTab('standings')}
                      className={`pb-4 text-sm font-display font-bold border-b-2 uppercase tracking-wider transition-all flex items-center gap-2 ${
                        activeTab === 'standings' ? 'border-accent-gold text-accent-gold' : 'border-transparent text-nebula-gray hover:text-foreground'
                      }`}
                    >
                      <Trophy className="w-4 h-4" /> Leaderboard
                    </button>
                    {profile?.role === 'admin' && (
                      <button
                        onClick={() => setActiveTab('admins')}
                        className={`pb-4 text-sm font-display font-bold border-b-2 uppercase tracking-wider transition-all flex items-center gap-2 ${
                          activeTab === 'admins' ? 'border-accent-gold text-accent-gold' : 'border-transparent text-nebula-gray hover:text-foreground'
                        }`}
                      >
                        <Shield className="w-4 h-4" /> Admins
                      </button>
                    )}
                  </div>

                  <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-surface rounded-xl border border-white/5">
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
                    onTeamsUpdated={reloadTeams}
                    isAdmin={profile?.role === 'admin'}
                    session={session}
                  />
                )}

                {activeTab === 'fixtures' && (
                  <Fixtures
                    tournament={activeTournament}
                    teams={teams}
                    onSelectMatch={setSelectedMatchId}
                    refreshTrigger={refreshTrigger}
                    isAdmin={profile?.role === 'admin'}
                    onRefresh={triggerRefresh}
                  />
                )}

                {activeTab === 'standings' && (
                  <PointsTable tournament={activeTournament} refreshTrigger={refreshTrigger} />
                )}

                {activeTab === 'admins' && profile?.role === 'admin' && (
                  <div className="py-8">
                    <AdminManagement />
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        </main>
      )}
    </div>
  );
}
