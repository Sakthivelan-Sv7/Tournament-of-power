'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { db, Team, Player, Tournament } from '../utils/db';
import { Avatar } from './Avatar';
import {
  Plus, UserPlus, Upload, Shield, Users, Trophy,
  CheckCircle, XCircle, Clock, ChevronDown, ChevronUp,
  AlertTriangle, Loader2, Trash2
} from 'lucide-react';

interface RegistrationProps {
  tournament: Tournament;
  onActiveTrigger: () => void;
  onTeamsUpdated?: () => void;
  isAdmin?: boolean;
  session?: any;
}

const NATIONS = [
  { code: '', label: 'None' },
  { code: 'BR', label: '🇧🇷 Brazil' },
  { code: 'DE', label: '🇩🇪 Germany' },
  { code: 'ES', label: '🇪🇸 Spain' },
  { code: 'IT', label: '🇮🇹 Italy' },
  { code: 'FR', label: '🇫🇷 France' },
  { code: 'PT', label: '🇵🇹 Portugal' },
  { code: 'GB', label: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 England' },
  { code: 'NL', label: '🇳🇱 Netherlands' },
  { code: 'AR', label: '🇦🇷 Argentina' },
  { code: 'US', label: '🇺🇸 United States' },
  { code: 'JP', label: '🇯🇵 Japan' },
  { code: 'KR', label: '🇰🇷 South Korea' },
  { code: 'IN', label: '🇮🇳 India' },
  { code: 'MX', label: '🇲🇽 Mexico' },
  { code: 'NG', label: '🇳🇬 Nigeria' },
  { code: 'CM', label: '🇨🇲 Cameroon' },
  { code: 'EG', label: '🇪🇬 Egypt' },
  { code: 'AU', label: '🇦🇺 Australia' },
  { code: 'BE', label: '🇧🇪 Belgium' },
  { code: 'HR', label: '🇭🇷 Croatia' },
  { code: 'SE', label: '🇸🇪 Sweden' },
  { code: 'TR', label: '🇹🇷 Turkey' },
  { code: 'MA', label: '🇲🇦 Morocco' },
  { code: 'SN', label: '🇸🇳 Senegal' },
  { code: 'SA', label: '🇸🇦 Saudi Arabia' },
  { code: 'PK', label: '🇵🇰 Pakistan' },
];

const ROLES = ['Goalkeeper', 'Defender', 'Midfielder', 'Forward'];

const StatusBadge: React.FC<{ status?: string }> = ({ status }) => {
  if (status === 'accepted') return (
    <span className="flex items-center gap-1 text-[9px] font-mono font-bold uppercase bg-success/15 text-success border border-success/25 px-2 py-0.5 rounded-full">
      <CheckCircle className="w-2.5 h-2.5" /> Accepted
    </span>
  );
  if (status === 'rejected') return (
    <span className="flex items-center gap-1 text-[9px] font-mono font-bold uppercase bg-error/15 text-error border border-error/25 px-2 py-0.5 rounded-full">
      <XCircle className="w-2.5 h-2.5" /> Rejected
    </span>
  );
  return (
    <span className="flex items-center gap-1 text-[9px] font-mono font-bold uppercase bg-amber-500/15 text-amber-400 border border-amber-500/25 px-2 py-0.5 rounded-full">
      <Clock className="w-2.5 h-2.5" /> Pending
    </span>
  );
};

export const Registration: React.FC<RegistrationProps> = ({
  tournament,
  onActiveTrigger,
  onTeamsUpdated,
  isAdmin,
  session,
}) => {
  // All teams (for admin) vs accepted teams (for display in roster)
  const [allTeams, setAllTeams] = useState<Team[]>([]);
  const [acceptedTeams, setAcceptedTeams] = useState<Team[]>([]);
  const [pendingTeams, setPendingTeams] = useState<Team[]>([]);

  const [activeTab, setActiveTab] = useState<'teams' | 'players'>('teams');
  const [unassignedPlayers, setUnassignedPlayers] = useState<Player[]>([]);
  const [rosters, setRosters] = useState<Record<string, Player[]>>({});

  // User registration form: team + player in one go
  const [teamName, setTeamName] = useState('');
  const [teamColor, setTeamColor] = useState('#FACC15');
  const [teamNation, setTeamNation] = useState('');
  const [teamLogoFile, setTeamLogoFile] = useState<File | null>(null);
  const [teamLogoPreview, setTeamLogoPreview] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [playerPhotoFile, setPlayerPhotoFile] = useState<File | null>(null);
  const [playerPhotoPreview, setPlayerPhotoPreview] = useState('');
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerSuccess, setRegisterSuccess] = useState('');
  const [registerError, setRegisterError] = useState('');

  // Admin-only player add form
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [adminPlayerName, setAdminPlayerName] = useState('');
  const [adminPlayerRole, setAdminPlayerRole] = useState('Midfielder');
  const [adminPlayerPhotoFile, setAdminPlayerPhotoFile] = useState<File | null>(null);
  const [adminPlayerPhotoPreview, setAdminPlayerPhotoPreview] = useState('');
  const [makeCaptain, setMakeCaptain] = useState(false);
  const [playerLoading, setPlayerLoading] = useState(false);

  // Admin team form
  const [adminTeamName, setAdminTeamName] = useState('');
  const [adminTeamColor, setAdminTeamColor] = useState('#FACC15');
  const [adminTeamNation, setAdminTeamNation] = useState('');
  const [adminTeamLogoFile, setAdminTeamLogoFile] = useState<File | null>(null);
  const [adminTeamLogoPreview, setAdminTeamLogoPreview] = useState('');
  const [adminTeamLoading, setAdminTeamLoading] = useState(false);

  // Approval loading
  const [approvingId, setApprovingId] = useState<string | null>(null);

  // Show/hide pending section for admin
  const [showPending, setShowPending] = useState(true);

  const loadTeamsAndPlayers = useCallback(async () => {
    try {
      const all = await db.getTeams(tournament.id);
      const accepted = all.filter(t => t.status === 'accepted' || !t.status); // backwards compat
      const pending = all.filter(t => t.status === 'pending');

      setAllTeams(all);
      setAcceptedTeams(accepted);
      setPendingTeams(pending);

      if (accepted.length > 0 && !selectedTeamId) {
        setSelectedTeamId(accepted[0].id);
      }

      const allPlayers = await db.getTournamentPlayers(tournament.id);
      const unassigned = allPlayers.filter(p => !p.team_id);
      setUnassignedPlayers(unassigned);

      const rosterMap: Record<string, Player[]> = {};
      all.forEach(t => {
        rosterMap[t.id] = allPlayers.filter(p => p.team_id === t.id);
      });
      setRosters(rosterMap);
    } catch (err) {
      console.error('Error loading registration data:', err);
    }
  }, [tournament.id, selectedTeamId]);

  useEffect(() => {
    loadTeamsAndPlayers();
  }, [loadTeamsAndPlayers]);

  const handleFileChange = (
    file: File | undefined,
    setFile: (f: File | null) => void,
    setPreview: (s: string) => void
  ) => {
    if (!file) return;
    setFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  // User submits a registration request (team + player name + logo)
  const handleUserRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName || !playerName) return;
    setRegisterLoading(true);
    setRegisterSuccess('');
    setRegisterError('');

    try {
      let logoUrl = '';
      if (teamLogoFile) {
        logoUrl = await db.uploadFile('logos', teamLogoFile);
      }

      // Create team with pending status
      const team = await db.registerTeam({
        tournament_id: tournament.id,
        name: teamName,
        logo_url: logoUrl || undefined,
        color_hex: teamColor,
        nation: teamNation || undefined,
      });

      // Register player linked to the new team and the user
      await db.registerPlayer({
        tournament_id: tournament.id,
        team_id: team.id,
        name: playerName,
        photo_url: playerPhotoPreview || undefined,
        role: 'Player',
        user_id: session?.user?.id || undefined,
      });

      setRegisterSuccess(`Your team "${teamName}" has been submitted! Awaiting admin approval.`);
      setTeamName('');
      setPlayerName('');
      setTeamLogoFile(null);
      setTeamLogoPreview('');
      setPlayerPhotoFile(null);
      setPlayerPhotoPreview('');
      setTeamNation('');
      loadTeamsAndPlayers();
      onTeamsUpdated?.();
    } catch (err: any) {
      console.error(err);
      setRegisterError(err.message || 'Registration failed. Please try again.');
    } finally {
      setRegisterLoading(false);
    }
  };

  // Admin handles approval / rejection
  const handleApproval = async (teamId: string, status: 'accepted' | 'rejected') => {
    setApprovingId(teamId);
    try {
      await db.updateTeamStatus(teamId, status);
      await loadTeamsAndPlayers();
      onTeamsUpdated?.();
    } catch (err) {
      console.error(err);
    } finally {
      setApprovingId(null);
    }
  };

  // Admin creates a team directly (bypasses pending → auto-accepted)
  const handleAdminCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminTeamName) return;
    setAdminTeamLoading(true);
    try {
      let logoUrl = '';
      if (adminTeamLogoFile) {
        logoUrl = await db.uploadFile('logos', adminTeamLogoFile);
      }
      const team = await db.registerTeam({
        tournament_id: tournament.id,
        name: adminTeamName,
        logo_url: logoUrl || undefined,
        color_hex: adminTeamColor,
        nation: adminTeamNation || undefined,
      });
      // Auto-accept admin-created teams
      await db.updateTeamStatus(team.id, 'accepted');
      setAdminTeamName('');
      setAdminTeamNation('');
      setAdminTeamLogoFile(null);
      setAdminTeamLogoPreview('');
      loadTeamsAndPlayers();
      onTeamsUpdated?.();
    } catch (err) {
      console.error(err);
    } finally {
      setAdminTeamLoading(false);
    }
  };

  // Admin adds a player to an accepted team
  const handleAdminAddPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminPlayerName || !selectedTeamId) return;
    setPlayerLoading(true);
    try {
      let photoUrl = '';
      if (adminPlayerPhotoFile) {
        photoUrl = await db.uploadFile('players', adminPlayerPhotoFile);
      }
      const player = await db.registerPlayer({
        tournament_id: tournament.id,
        team_id: selectedTeamId,
        name: adminPlayerName,
        photo_url: photoUrl || undefined,
        role: adminPlayerRole,
        user_id: undefined,
      });
      if (makeCaptain && selectedTeamId) {
        await db.updateTeamCaptain(selectedTeamId, player.id);
      }
      setAdminPlayerName('');
      setAdminPlayerPhotoFile(null);
      setAdminPlayerPhotoPreview('');
      setMakeCaptain(false);
      loadTeamsAndPlayers();
      onTeamsUpdated?.();
    } catch (err) {
      console.error(err);
    } finally {
      setPlayerLoading(false);
    }
  };

  const handleDeleteTeam = async (teamId: string, teamName: string) => {
    const isMidTournament = tournament.status === 'active' || tournament.status === 'completed';
    const message = isMidTournament
      ? `WARNING: Deleting "${teamName}" mid-tournament will permanently remove the team, its roster, and ALL associated matches and events. Standings and fixtures will recalculate immediately. This action cannot be undone.\n\nAre you sure you want to proceed?`
      : `Are you sure you want to delete the team "${teamName}"? This will delete all players and matches associated with the team. This action is irreversible.`;

    if (!confirm(message)) return;

    try {
      await db.deleteTeam(teamId);
      loadTeamsAndPlayers();
      onTeamsUpdated?.();
    } catch (err) {
      console.error('Error deleting team:', err);
      alert('Failed to delete team. Please try again.');
    }
  };

  const handleRemovePlayer = async (playerId: string, playerName: string, teamName: string) => {
    if (!confirm(`Are you sure you want to remove "${playerName}" from "${teamName}"? They will be returned to the unassigned Draft Pool.`)) return;

    try {
      await db.assignPlayerToTeam(playerId, null);
      loadTeamsAndPlayers();
      onTeamsUpdated?.();
    } catch (err) {
      console.error('Error removing player:', err);
      alert('Failed to remove player. Please try again.');
    }
  };

  return (
    <div className="w-full space-y-8">
      {/* Tournament Status Header */}
      <div className="bg-surface/30 border border-white/5 rounded-3xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <Avatar src={tournament.logo_url} name={tournament.name} size="lg" shape="square" colorHex="#FACC15" />
          <div>
            <span className="px-2 py-0.5 bg-accent-gold/10 border border-accent-gold/20 text-accent-gold text-[10px] uppercase font-bold tracking-wider rounded">
              Registry Phase
            </span>
            <h2 className="text-xl font-display font-bold text-foreground mt-1">{tournament.name}</h2>
            <p className="text-xs text-nebula-gray">
              Sport: <span className="text-foreground capitalize">{tournament.sport_type}</span> · Format: <span className="text-foreground capitalize">{tournament.format}</span>
            </p>
          </div>
        </div>

        {isAdmin ? (
          acceptedTeams.length >= 2 ? (
            <button
              onClick={onActiveTrigger}
              className="flex items-center justify-center gap-2 px-6 py-3.5 bg-accent-gold hover:bg-yellow-400 text-background rounded-xl text-xs font-extrabold tracking-wider uppercase transition-all shadow-[0_0_15px_rgba(250,204,21,0.2)] hover:shadow-[0_0_20px_rgba(250,204,21,0.4)]"
            >
              <Trophy className="w-4 h-4" />
              <span>Generate Fixtures & Start</span>
            </button>
          ) : (
            <div className="text-right">
              <span className="text-xs text-error font-mono font-medium block">
                [LOCKED] Requires minimum 2 accepted teams
              </span>
              <span className="text-[10px] text-nebula-gray block mt-0.5">
                Accept pending team requests to begin.
              </span>
            </div>
          )
        ) : (
          <div className="text-right">
            <span className="text-xs text-nebula-gray font-mono">Register your team below</span>
          </div>
        )}
      </div>

      {/* ===== ADMIN VIEW ===== */}
      {isAdmin ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Admin Forms */}
          <div className="bg-surface/50 border border-white/5 rounded-3xl p-6 h-fit space-y-6">
            <div className="flex border-b border-white/5 p-1 bg-background rounded-2xl">
              <button
                onClick={() => setActiveTab('teams')}
                className={`flex-1 py-2.5 text-center text-xs font-bold rounded-xl transition-all ${
                  activeTab === 'teams' ? 'bg-surface text-accent-gold shadow-md' : 'text-nebula-gray hover:text-foreground'
                }`}
              >
                Register Team
              </button>
              <button
                disabled={acceptedTeams.length === 0}
                onClick={() => setActiveTab('players')}
                className={`flex-1 py-2.5 text-center text-xs font-bold rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
                  activeTab === 'players' ? 'bg-surface text-accent-gold shadow-md' : 'text-nebula-gray hover:text-foreground'
                }`}
              >
                Add Players
              </button>
            </div>

            {activeTab === 'teams' ? (
              <form onSubmit={handleAdminCreateTeam} className="space-y-5">
                <h3 className="font-display font-semibold text-base flex items-center gap-2">
                  <Plus className="w-5 h-5 text-accent-gold" /> Add Team (Direct)
                </h3>
                <p className="text-xs text-nebula-gray -mt-2">Teams created here are auto-accepted.</p>

                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-nebula-gray mb-1.5 font-bold">Team Name</label>
                  <input type="text" required value={adminTeamName} onChange={e => setAdminTeamName(e.target.value)}
                    placeholder="e.g., Solar Striker FC"
                    className="w-full bg-background border border-white/5 focus:border-accent-gold/40 rounded-xl px-4 py-3 text-sm outline-none transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-nebula-gray mb-1.5 font-bold">Jersey Color</label>
                    <div className="flex items-center gap-3">
                      <input type="color" value={adminTeamColor} onChange={e => setAdminTeamColor(e.target.value)}
                        className="w-12 h-10 bg-background rounded-lg border border-white/5 cursor-pointer p-1"
                      />
                      <span className="text-xs font-mono">{adminTeamColor.toUpperCase()}</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-nebula-gray mb-1.5 font-bold">Nation</label>
                    <select value={adminTeamNation} onChange={e => setAdminTeamNation(e.target.value)}
                      className="w-full bg-background border border-white/5 rounded-xl px-3 py-2 text-xs outline-none text-foreground"
                    >
                      {NATIONS.map(n => <option key={n.code} value={n.code}>{n.label}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-nebula-gray mb-1.5 font-bold">Team Logo</label>
                  <div className="flex items-center gap-4">
                    {adminTeamLogoPreview ? (
                      <Avatar src={adminTeamLogoPreview} name={adminTeamName || 'T'} size="md" shape="square" colorHex={adminTeamColor} />
                    ) : (
                      <div className="w-12 h-12 rounded-lg border border-dashed border-white/10 flex items-center justify-center text-nebula-gray bg-background">
                        <Shield className="w-5 h-5 opacity-40" />
                      </div>
                    )}
                    <label className="flex items-center gap-2 cursor-pointer bg-surface hover:bg-surface-hover border border-white/5 hover:border-white/10 rounded-xl px-4 py-2.5 text-xs font-bold text-foreground transition-all">
                      <Upload className="w-4 h-4 text-accent-gold" />
                      <span>Upload</span>
                      <input type="file" accept="image/*" className="hidden" onChange={e => handleFileChange(e.target.files?.[0], setAdminTeamLogoFile, setAdminTeamLogoPreview)} />
                    </label>
                  </div>
                </div>

                <button type="submit" disabled={adminTeamLoading}
                  className="w-full py-3 bg-accent-gold hover:bg-yellow-400 text-background rounded-xl text-xs font-extrabold tracking-wider uppercase transition-all"
                >
                  {adminTeamLoading ? 'Registering...' : 'Register Team'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleAdminAddPlayer} className="space-y-5">
                <h3 className="font-display font-semibold text-base flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-accent-cyan" /> Add Player
                </h3>

                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-nebula-gray mb-1.5 font-bold">Assign to Team</label>
                  <select value={selectedTeamId} onChange={e => setSelectedTeamId(e.target.value)}
                    className="w-full bg-background border border-white/5 rounded-xl px-3 py-2.5 text-sm outline-none text-foreground"
                  >
                    {acceptedTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-nebula-gray mb-1.5 font-bold">Player Name</label>
                  <input type="text" required value={adminPlayerName} onChange={e => setAdminPlayerName(e.target.value)}
                    placeholder="e.g., Kakarot"
                    className="w-full bg-background border border-white/5 focus:border-accent-cyan/40 rounded-xl px-4 py-3 text-sm outline-none transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-nebula-gray mb-1.5 font-bold">Role</label>
                    <select value={adminPlayerRole} onChange={e => setAdminPlayerRole(e.target.value)}
                      className="w-full bg-background border border-white/5 rounded-xl px-3 py-2.5 text-xs outline-none text-foreground"
                    >
                      {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div className="flex items-end pb-1">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input type="checkbox" checked={makeCaptain} onChange={e => setMakeCaptain(e.target.checked)}
                        className="w-4 h-4 bg-background border-white/10 rounded accent-accent-cyan cursor-pointer"
                      />
                      <span className="text-xs text-nebula-gray">Captain</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-nebula-gray mb-1.5 font-bold">Player Photo</label>
                  <div className="flex items-center gap-4">
                    {adminPlayerPhotoPreview ? (
                      <Avatar src={adminPlayerPhotoPreview} name={adminPlayerName || 'P'} size="md" shape="circle" />
                    ) : (
                      <div className="w-12 h-12 rounded-full border border-dashed border-white/10 flex items-center justify-center text-nebula-gray bg-background">
                        <Users className="w-5 h-5 opacity-40" />
                      </div>
                    )}
                    <label className="flex items-center gap-2 cursor-pointer bg-surface hover:bg-surface-hover border border-white/5 hover:border-white/10 rounded-xl px-4 py-2.5 text-xs font-bold text-foreground transition-all">
                      <Upload className="w-4 h-4 text-accent-cyan" />
                      <span>Upload</span>
                      <input type="file" accept="image/*" className="hidden" onChange={e => handleFileChange(e.target.files?.[0], setAdminPlayerPhotoFile, setAdminPlayerPhotoPreview)} />
                    </label>
                  </div>
                </div>

                <button type="submit" disabled={playerLoading}
                  className="w-full py-3 bg-accent-cyan hover:bg-cyan-400 text-background rounded-xl text-xs font-extrabold tracking-wider uppercase transition-all"
                >
                  {playerLoading ? 'Processing...' : 'Add Player'}
                </button>
              </form>
            )}
          </div>

          {/* Admin Right Panel */}
          <div className="lg:col-span-2 space-y-8">
            {/* Pending Approval Section */}
            {pendingTeams.length > 0 && (
              <div className="bg-amber-500/5 border border-amber-500/20 rounded-3xl p-6 space-y-4">
                <button
                  onClick={() => setShowPending(v => !v)}
                  className="w-full flex items-center justify-between"
                >
                  <h3 className="font-display font-bold text-base text-amber-400 flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    Pending Approval
                    <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full font-mono border border-amber-500/30">
                      {pendingTeams.length}
                    </span>
                  </h3>
                  {showPending ? <ChevronUp className="w-4 h-4 text-amber-400" /> : <ChevronDown className="w-4 h-4 text-amber-400" />}
                </button>

                {showPending && (
                  <div className="space-y-3">
                    {pendingTeams.map(team => {
                      const roster = rosters[team.id] || [];
                      return (
                        <div key={team.id} className="flex items-center justify-between p-4 bg-background/50 border border-amber-500/10 rounded-2xl hover:border-amber-500/25 transition-all">
                          <div className="flex items-center gap-3">
                            <Avatar src={team.logo_url} name={team.name} size="md" shape="square" colorHex={team.color_hex} />
                            <div>
                              <h4 className="text-sm font-bold text-foreground">{team.name}</h4>
                              <p className="text-[10px] text-nebula-gray font-mono">
                                {roster.length} player{roster.length !== 1 ? 's' : ''} · {roster[0]?.name || 'No players yet'}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleApproval(team.id, 'rejected')}
                              disabled={approvingId === team.id}
                              className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-error border border-error/20 bg-error/5 hover:bg-error/15 rounded-xl transition-all disabled:opacity-50"
                            >
                              {approvingId === team.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                              Reject
                            </button>
                            <button
                              onClick={() => handleApproval(team.id, 'accepted')}
                              disabled={approvingId === team.id}
                              className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-success border border-success/20 bg-success/5 hover:bg-success/15 rounded-xl transition-all disabled:opacity-50"
                            >
                              {approvingId === team.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                              Accept
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Draft Pool — Unassigned players */}
            {unassignedPlayers.length > 0 && (
              <div className="bg-surface/30 border border-white/5 rounded-3xl p-6 space-y-4">
                <div className="flex justify-between items-center border-b border-white/5 pb-3">
                  <h3 className="font-display font-bold text-base text-foreground flex items-center gap-2">
                    <UserPlus className="w-5 h-5 text-accent-cyan" /> Draft Pool ({unassignedPlayers.length})
                  </h3>
                  <span className="text-[10px] text-nebula-gray font-mono uppercase">Needs Team Assignment</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-72 overflow-y-auto pr-1">
                  {unassignedPlayers.map(player => (
                    <div key={player.id} className="flex items-center justify-between p-3 bg-background/50 rounded-xl border border-white/5 hover:border-white/10 transition-all">
                      <div className="flex items-center gap-2.5">
                        <Avatar src={player.photo_url} name={player.name} size="xs" />
                        <span className="text-xs text-foreground font-semibold">{player.name}</span>
                      </div>
                      <select
                        onChange={async e => {
                          const val = e.target.value;
                          if (val) {
                            await db.assignPlayerToTeam(player.id, val);
                            loadTeamsAndPlayers();
                            onTeamsUpdated?.();
                          }
                        }}
                        defaultValue=""
                        className="bg-surface border border-white/10 text-xs text-foreground rounded-lg px-2 py-1 outline-none cursor-pointer focus:border-accent-cyan/50"
                      >
                        <option value="" disabled>Assign...</option>
                        {acceptedTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Accepted Teams Roster */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-display font-bold text-lg text-foreground flex items-center gap-2">
                  <Users className="w-5 h-5 text-accent-gold" /> Registered Teams
                  <span className="text-xs font-mono bg-success/10 text-success border border-success/20 px-2 py-0.5 rounded-full">{acceptedTeams.length} accepted</span>
                </h3>
              </div>

              {acceptedTeams.length === 0 ? (
                <div className="border border-dashed border-white/5 rounded-3xl p-12 text-center text-nebula-gray bg-surface/20">
                  <Shield className="w-12 h-12 mx-auto text-white/10 mb-4" />
                  <p className="font-display text-sm font-semibold text-foreground">No teams accepted yet</p>
                  <p className="text-xs text-nebula-gray mt-1">Accept pending requests or create teams directly.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {acceptedTeams.map(t => {
                    const teamRoster = rosters[t.id] || [];
                    const captain = teamRoster.find(p => p.id === t.captain_id);
                    return (
                      <div key={t.id} className="bg-surface/40 border border-white/5 rounded-2xl p-5 hover:border-white/10 transition-all">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <Avatar src={t.logo_url} name={t.name} size="md" shape="square" colorHex={t.color_hex} />
                            <div>
                              <h4 className="font-display font-semibold text-sm text-foreground">{t.name}</h4>
                              {captain && (
                                <span className="text-[10px] text-accent-gold flex items-center gap-1 mt-0.5">
                                  <Trophy className="w-3 h-3" /> {captain.name}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded-full border border-white/10" style={{ backgroundColor: t.color_hex }} />
                            {isAdmin && (
                              <button
                                onClick={() => handleDeleteTeam(t.id, t.name)}
                                className="p-1 text-nebula-gray hover:text-error hover:bg-error/10 rounded-lg transition-all"
                                title="Delete Team"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="border-t border-white/5 pt-3">
                          <span className="text-[10px] uppercase font-bold tracking-widest text-nebula-gray mb-2 block">Roster ({teamRoster.length})</span>
                          {teamRoster.length === 0 ? (
                            <p className="text-[10px] text-nebula-gray italic">No players yet</p>
                          ) : (
                            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                              {teamRoster.map(player => (
                                <div key={player.id} className="flex items-center justify-between p-1.5 bg-background/50 rounded-lg border border-white/5">
                                  <div className="flex items-center gap-2">
                                    <Avatar src={player.photo_url} name={player.name} size="xs" colorHex={t.color_hex} />
                                    <span className="text-xs text-foreground font-medium">{player.name}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[9px] bg-surface text-nebula-gray px-1.5 py-0.5 rounded font-mono uppercase">{player.role.substring(0, 3)}</span>
                                    {t.captain_id === player.id && (
                                      <span className="text-[9px] bg-accent-gold/20 text-accent-gold px-1.5 py-0.5 rounded font-mono font-bold uppercase">CPT</span>
                                    )}
                                    {isAdmin && (
                                      <button
                                        onClick={() => handleRemovePlayer(player.id, player.name, t.name)}
                                        className="p-0.5 text-nebula-gray hover:text-error hover:bg-error/10 rounded transition-all"
                                        title="Remove Player"
                                      >
                                        <XCircle className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
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
      ) : (
        /* ===== USER VIEW ===== */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {/* Registration Form */}
          <div className="bg-surface/50 border border-white/5 rounded-3xl p-6 space-y-6">
            <div>
              <h3 className="font-display font-bold text-xl text-foreground flex items-center gap-2 mb-1">
                <Plus className="w-6 h-6 text-accent-gold" /> Register Your Team
              </h3>
              <p className="text-xs text-nebula-gray">Submit your team for admin approval to enter the tournament.</p>
            </div>

            {registerSuccess && (
              <div className="p-4 rounded-2xl bg-success/10 border border-success/25 flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-success shrink-0 mt-0.5" />
                <p className="text-sm text-success leading-relaxed">{registerSuccess}</p>
              </div>
            )}

            {registerError && (
              <div className="p-4 rounded-2xl bg-error/10 border border-error/25 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-error shrink-0 mt-0.5" />
                <p className="text-sm text-error">{registerError}</p>
              </div>
            )}

            <form onSubmit={handleUserRegister} className="space-y-5">
              {/* Team Section */}
              <div className="space-y-4 pb-5 border-b border-white/5">
                <p className="text-[10px] uppercase font-bold tracking-widest text-accent-gold">Team Details</p>

                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-nebula-gray mb-1.5 font-bold">Team Name *</label>
                  <input type="text" required value={teamName} onChange={e => setTeamName(e.target.value)}
                    placeholder="e.g., FC Thunder Strike"
                    className="w-full bg-background border border-white/5 focus:border-accent-gold/40 focus:ring-1 focus:ring-accent-gold/40 rounded-xl px-4 py-3 text-sm outline-none transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-nebula-gray mb-1.5 font-bold">Jersey Color</label>
                    <div className="flex items-center gap-3">
                      <input type="color" value={teamColor} onChange={e => setTeamColor(e.target.value)}
                        className="w-12 h-10 bg-background rounded-lg border border-white/5 cursor-pointer p-1"
                      />
                      <span className="text-xs font-mono">{teamColor.toUpperCase()}</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-nebula-gray mb-1.5 font-bold">Nation</label>
                    <select value={teamNation} onChange={e => setTeamNation(e.target.value)}
                      className="w-full bg-background border border-white/5 rounded-xl px-3 py-2 text-xs outline-none text-foreground"
                    >
                      {NATIONS.map(n => <option key={n.code} value={n.code}>{n.label}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-nebula-gray mb-1.5 font-bold">Team Logo</label>
                  <div className="flex items-center gap-4">
                    {teamLogoPreview ? (
                      <Avatar src={teamLogoPreview} name={teamName || 'T'} size="md" shape="square" colorHex={teamColor} />
                    ) : (
                      <div className="w-12 h-12 rounded-lg border-2 border-dashed border-white/10 flex items-center justify-center text-nebula-gray bg-background">
                        <Shield className="w-5 h-5 opacity-40" />
                      </div>
                    )}
                    <label className="flex items-center gap-2 cursor-pointer bg-surface hover:bg-surface-hover border border-white/5 hover:border-accent-gold/30 rounded-xl px-4 py-2.5 text-xs font-bold text-foreground transition-all">
                      <Upload className="w-4 h-4 text-accent-gold" />
                      <span>{teamLogoPreview ? 'Change Logo' : 'Upload Logo'}</span>
                      <input type="file" accept="image/*" className="hidden" onChange={e => handleFileChange(e.target.files?.[0], setTeamLogoFile, setTeamLogoPreview)} />
                    </label>
                  </div>
                </div>
              </div>

              {/* Player Section */}
              <div className="space-y-4">
                <p className="text-[10px] uppercase font-bold tracking-widest text-accent-cyan">Your Player Info</p>

                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-nebula-gray mb-1.5 font-bold">Your Name *</label>
                  <input type="text" required value={playerName} onChange={e => setPlayerName(e.target.value)}
                    placeholder="Enter your full name"
                    className="w-full bg-background border border-white/5 focus:border-accent-cyan/40 focus:ring-1 focus:ring-accent-cyan/40 rounded-xl px-4 py-3 text-sm outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-nebula-gray mb-1.5 font-bold">Player Photo (Optional)</label>
                  <div className="flex items-center gap-4">
                    {playerPhotoPreview ? (
                      <Avatar src={playerPhotoPreview} name={playerName || 'P'} size="md" shape="circle" />
                    ) : (
                      <div className="w-12 h-12 rounded-full border-2 border-dashed border-white/10 flex items-center justify-center text-nebula-gray bg-background">
                        <Users className="w-5 h-5 opacity-40" />
                      </div>
                    )}
                    <label className="flex items-center gap-2 cursor-pointer bg-surface hover:bg-surface-hover border border-white/5 hover:border-accent-cyan/30 rounded-xl px-4 py-2.5 text-xs font-bold text-foreground transition-all">
                      <Upload className="w-4 h-4 text-accent-cyan" />
                      <span>{playerPhotoPreview ? 'Change Photo' : 'Upload Photo'}</span>
                      <input type="file" accept="image/*" className="hidden" onChange={e => handleFileChange(e.target.files?.[0], setPlayerPhotoFile, setPlayerPhotoPreview)} />
                    </label>
                  </div>
                </div>
              </div>

              <button type="submit" disabled={registerLoading || !teamName || !playerName}
                className="w-full py-3.5 bg-gradient-to-r from-accent-gold to-yellow-500 hover:from-yellow-400 hover:to-accent-gold text-background rounded-xl text-sm font-extrabold tracking-wider uppercase transition-all shadow-[0_0_20px_rgba(250,204,21,0.2)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {registerLoading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</>
                ) : (
                  <><Trophy className="w-4 h-4" /> Submit Registration Request</>
                )}
              </button>

              <div className="flex items-start gap-2 p-3 bg-surface/50 rounded-xl border border-white/5">
                <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-nebula-gray">
                  Your registration will be reviewed by an admin. You will be placed in the{' '}
                  <span className="text-amber-400 font-semibold">Pending</span> status until approved.
                </p>
              </div>
            </form>
          </div>

          {/* Right: Registered teams (read-only for users) */}
          <div className="space-y-6">
            <h3 className="font-display font-bold text-lg text-foreground flex items-center gap-2">
              <Users className="w-5 h-5 text-accent-gold" /> Tournament Teams
            </h3>

            {allTeams.length === 0 ? (
              <div className="border border-dashed border-white/5 rounded-3xl p-12 text-center bg-surface/20">
                <Shield className="w-12 h-12 mx-auto text-white/10 mb-4" />
                <p className="font-display text-sm font-semibold text-foreground">No teams registered yet</p>
                <p className="text-xs text-nebula-gray mt-1">Be the first to register!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {allTeams.map(t => (
                  <div key={t.id} className="flex items-center gap-4 p-4 bg-surface/40 border border-white/5 rounded-2xl hover:border-white/10 transition-all">
                    <Avatar src={t.logo_url} name={t.name} size="md" shape="square" colorHex={t.color_hex} />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-display font-semibold text-sm text-foreground truncate">{t.name}</h4>
                      <p className="text-[10px] text-nebula-gray font-mono">{rosters[t.id]?.length || 0} players</p>
                    </div>
                    <StatusBadge status={t.status} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
