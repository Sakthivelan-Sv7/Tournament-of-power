'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { db, Tournament, Team, Player, Profile } from '../../../utils/db';
import { supabase } from '../../../utils/supabaseClient';
import { Avatar } from '../../../components/Avatar';
import {
  Trophy, CheckCircle, XCircle, Clock, ChevronDown, ArrowLeft,
  Users, Shield, Loader2, AlertTriangle, ShieldAlert, Sparkles
} from 'lucide-react';
import Link from 'next/link';

// Flag emoji helper
const getFlagEmoji = (countryCode: string): string => {
  if (!countryCode || countryCode.length !== 2) return '';
  const codePoints = [...countryCode.toUpperCase()].map(
    c => 0x1F1E6 + c.charCodeAt(0) - 65
  );
  return String.fromCodePoint(...codePoints);
};

export default function ApprovalsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [activeTournament, setActiveTournament] = useState<Tournament | null>(null);
  const [pendingTeams, setPendingTeams] = useState<Team[]>([]);
  const [rosters, setRosters] = useState<Record<string, Player[]>>({});
  const [showTournamentDropdown, setShowTournamentDropdown] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [actionStatus, setActionStatus] = useState<string | null>(null);

  // Authenticate user and verify role
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        db.getProfile(session.user.id).then(p => {
          setProfile(p);
          if (p?.role !== 'admin') {
            setLoading(false); // Let UI render Access Denied
          } else {
            loadTournaments();
          }
        }).catch(err => {
          console.error(err);
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        db.getProfile(session.user.id).then(p => {
          setProfile(p);
          if (p?.role === 'admin') {
            loadTournaments();
          } else {
            setLoading(false);
          }
        });
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadTournaments = async () => {
    try {
      const allTournaments = await db.getTournaments();
      setTournaments(allTournaments);
      if (allTournaments.length > 0) {
        setActiveTournament(allTournaments[0]);
      } else {
        setLoading(false);
      }
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const loadPendingTeamsAndRosters = useCallback(async (tournamentId: string) => {
    try {
      const all = await db.getTeams(tournamentId);
      // Accept either explicit 'pending' status or missing/undefined (fallback cases)
      const pending = all.filter(t => !t.status || t.status === 'pending');
      setPendingTeams(pending);

      const allPlayers = await db.getTournamentPlayers(tournamentId);
      const rosterMap: Record<string, Player[]> = {};
      pending.forEach(t => {
        rosterMap[t.id] = allPlayers.filter(p => p.team_id === t.id);
      });
      setRosters(rosterMap);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTournament) {
      loadPendingTeamsAndRosters(activeTournament.id);
    }
  }, [activeTournament, loadPendingTeamsAndRosters]);

  const handleSelectTournament = (t: Tournament) => {
    setShowTournamentDropdown(false);
    setActiveTournament(t);
  };

  const handleApproval = async (teamId: string, status: 'accepted' | 'rejected') => {
    setApprovingId(teamId);
    setActionStatus(null);
    try {
      await db.updateTeamStatus(teamId, status);
      setActionStatus(`Team has been successfully ${status}!`);
      if (activeTournament) {
        await loadPendingTeamsAndRosters(activeTournament.id);
      }
    } catch (err: any) {
      console.error(err);
      setActionStatus(`Error updating team: ${err.message}`);
    } finally {
      setApprovingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-background text-foreground font-mono">
        <Loader2 className="w-10 h-10 text-accent-gold animate-spin mb-4" />
        <span>SYNCING THE OMNIVERSE APPROVAL SYSTEM...</span>
      </div>
    );
  }

  // Route protection view
  if (!session || profile?.role !== 'admin') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto">
        <div className="w-16 h-16 rounded-2xl bg-error/10 border border-error/20 flex items-center justify-center mb-6">
          <ShieldAlert className="w-8 h-8 text-error" />
        </div>
        <h2 className="text-xl font-display font-bold text-foreground uppercase tracking-wider mb-2">
          Access Denied
        </h2>
        <p className="text-sm text-nebula-gray mb-6 leading-relaxed">
          This portal is restricted to authorized tournament organizers only. Please sign in with an administrator account.
        </p>
        <Link href="/" className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/5 hover:border-white/10 rounded-xl text-xs font-bold transition-all">
          Return to Registry
        </Link>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Approvals Page Topbar */}
      <header className="border-b border-white/5 bg-surface/50 backdrop-blur-md px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="p-2 hover:bg-white/5 border border-transparent hover:border-white/10 rounded-xl transition-all"
          >
            <ArrowLeft className="w-4 h-4 text-nebula-gray hover:text-foreground" />
          </Link>
          <div>
            <h1 className="font-display font-bold tracking-wider text-sm sm:text-base text-foreground uppercase">
              Admin Approvals
            </h1>
            <p className="text-[10px] text-nebula-gray tracking-wide">ORGANIZER DASHBOARD</p>
          </div>
        </div>

        {/* Tournament Selector */}
        {tournaments.length > 0 && activeTournament && (
          <div className="relative flex justify-end w-full max-w-xs">
            <button
              onClick={() => setShowTournamentDropdown(v => !v)}
              className="flex items-center gap-2 px-4 py-2 bg-surface border border-white/10 hover:border-white/20 rounded-xl text-xs font-bold text-foreground transition-all w-full justify-between"
            >
              <div className="flex items-center gap-2 truncate">
                <Trophy className="w-3.5 h-3.5 text-accent-gold shrink-0" />
                <span className="truncate">{activeTournament.name}</span>
              </div>
              <ChevronDown className={`w-3.5 h-3.5 text-nebula-gray shrink-0 transition-transform ${showTournamentDropdown ? 'rotate-180' : ''}`} />
            </button>
            {showTournamentDropdown && (
              <div className="absolute top-full right-0 mt-2 w-full bg-surface border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50">
                {tournaments.map(t => (
                  <button
                    key={t.id}
                    onClick={() => handleSelectTournament(t)}
                    className={`w-full flex items-center justify-between px-4 py-3 text-xs font-semibold text-left hover:bg-white/5 transition-colors ${activeTournament.id === t.id ? 'text-accent-gold bg-accent-gold/5' : 'text-foreground'}`}
                  >
                    <span className="truncate">{t.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 md:p-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent-gold/10 border border-accent-gold/20 flex items-center justify-center">
            <Clock className="w-5 h-5 text-accent-gold" />
          </div>
          <div>
            <h2 className="text-xl font-display font-bold text-white uppercase tracking-wider">Pending Registrations</h2>
            <p className="text-xs text-nebula-gray">Review and approve team entry requests for {activeTournament?.name}.</p>
          </div>
        </div>

        {actionStatus && (
          <div className="p-4 rounded-2xl bg-success/15 border border-success/25 flex items-center gap-3 text-sm text-success">
            <CheckCircle className="w-5 h-5 shrink-0" />
            <span>{actionStatus}</span>
          </div>
        )}

        {pendingTeams.length === 0 ? (
          <div className="border border-dashed border-white/5 rounded-3xl p-16 text-center bg-surface/20">
            <Shield className="w-12 h-12 mx-auto text-white/10 mb-4 animate-pulse" />
            <h3 className="font-display text-sm font-semibold text-foreground">All Clear!</h3>
            <p className="text-xs text-nebula-gray mt-1">There are currently no pending registration requests for this tournament.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {pendingTeams.map(team => {
              const roster = rosters[team.id] || [];
              const captain = roster.find(p => p.id === team.captain_id) || roster[0];
              
              return (
                <div
                  key={team.id}
                  className="bg-surface/50 border border-white/5 rounded-3xl p-6 hover:border-white/10 transition-all flex flex-col md:flex-row md:items-start justify-between gap-6"
                >
                  {/* Left: Team and Captain details */}
                  <div className="space-y-4 flex-1">
                    <div className="flex items-start gap-4">
                      <Avatar src={team.logo_url} name={team.name} size="lg" shape="square" colorHex={team.color_hex} />
                      <div>
                        <div className="flex items-center gap-2.5">
                          <h3 className="font-display font-bold text-lg text-foreground">{team.name}</h3>
                          <div className="w-4 h-4 rounded-full border border-white/10" style={{ backgroundColor: team.color_hex }} title={`Jersey Color: ${team.color_hex}`} />
                          {team.nation && (
                            <span className="text-xl" title={team.nation}>{getFlagEmoji(team.nation)}</span>
                          )}
                        </div>
                        <p className="text-xs text-nebula-gray mt-0.5">
                          Submitted details: <span className="text-foreground capitalize font-mono">{team.nation || 'None'}</span> nation · <span className="text-foreground font-mono">{team.color_hex.toUpperCase()}</span> color
                        </p>
                      </div>
                    </div>

                    {/* Captain & Roster details */}
                    <div className="border-t border-white/5 pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <span className="text-[10px] uppercase font-bold tracking-widest text-nebula-gray block mb-1">CAPTAIN & CONTACT</span>
                        {captain ? (
                          <div className="flex items-center gap-2.5 p-3 bg-background/40 rounded-2xl border border-white/5">
                            <Avatar src={captain.photo_url} name={captain.name} size="xs" />
                            <div>
                              <div className="text-xs font-bold text-foreground">{captain.name}</div>
                              <div className="text-[9px] font-mono text-accent-gold uppercase mt-0.5">Team Captain</div>
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs text-nebula-gray italic">No captain assigned</div>
                        )}
                      </div>

                      <div>
                        <span className="text-[10px] uppercase font-bold tracking-widest text-nebula-gray block mb-1">ROSTER ({roster.length} Players)</span>
                        <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                          {roster.map(p => (
                            <div key={p.id} className="flex items-center justify-between p-2 bg-background/30 rounded-xl border border-white/5">
                              <div className="flex items-center gap-2">
                                <Avatar src={p.photo_url} name={p.name} size="xs" />
                                <span className="text-xs text-foreground font-medium">{p.name}</span>
                              </div>
                              <span className="text-[9px] bg-surface text-nebula-gray px-1.5 py-0.5 rounded font-mono uppercase">
                                {p.role.substring(0, 3)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex md:flex-col items-center justify-end gap-3 shrink-0 self-end md:self-start">
                    <button
                      onClick={() => handleApproval(team.id, 'rejected')}
                      disabled={approvingId === team.id}
                      className="flex-1 md:w-full flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-extrabold text-error border border-error/20 bg-error/5 hover:bg-error/15 rounded-xl transition-all disabled:opacity-50"
                    >
                      {approvingId === team.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                      <span>Reject Team</span>
                    </button>
                    <button
                      onClick={() => handleApproval(team.id, 'accepted')}
                      disabled={approvingId === team.id}
                      className="flex-1 md:w-full flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-extrabold text-success border border-success/20 bg-success/5 hover:bg-success/15 rounded-xl transition-all disabled:opacity-50"
                    >
                      {approvingId === team.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                      <span>Approve Entry</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
