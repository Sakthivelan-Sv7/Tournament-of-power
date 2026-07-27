'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { db, Team, Player, Tournament } from '../utils/db';
import { Avatar } from './Avatar';
import { Plus, UserPlus, Upload, Shield, Users, Trophy } from 'lucide-react';

interface RegistrationProps {
  tournament: Tournament;
  onActiveTrigger: () => void;
  onTeamsUpdated?: () => void;
  isAdmin?: boolean;
  session?: any;
}

export const Registration: React.FC<RegistrationProps> = ({
  tournament,
  onActiveTrigger,
  onTeamsUpdated,
  isAdmin,
  session,
}) => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [activeTab, setActiveTab] = useState<'teams' | 'players'>('teams');
  const [unassignedPlayers, setUnassignedPlayers] = useState<Player[]>([]);

  // Team Form States
  const [teamName, setTeamName] = useState('');
  const [teamColor, setTeamColor] = useState('#FACC15');
  const [teamNation, setTeamNation] = useState('');
  const [teamLogoFile, setTeamLogoFile] = useState<File | null>(null);
  const [teamLogoPreview, setTeamLogoPreview] = useState('');
  const [teamLoading, setTeamLoading] = useState(false);

  // Player Form States
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [playerRole, setPlayerRole] = useState('Midfielder');
  const [playerPhotoFile, setPlayerPhotoFile] = useState<File | null>(null);
  const [playerPhotoPreview, setPlayerPhotoPreview] = useState('');
  const [playerLoading, setPlayerLoading] = useState(false);
  const [makeCaptain, setMakeCaptain] = useState(false);

  // Roster lists grouped by team
  const [rosters, setRosters] = useState<Record<string, Player[]>>({});

  const loadTeamsAndPlayers = useCallback(async () => {
    try {
      const data = await db.getTeams(tournament.id);
      setTeams(data);
      if (data.length > 0 && !selectedTeamId) {
        setSelectedTeamId(data[0].id);
      }

      // Load all players in the tournament
      const allPlayers = await db.getTournamentPlayers(tournament.id);

      // Separate unassigned players
      const unassigned = allPlayers.filter(p => !p.team_id);
      setUnassignedPlayers(unassigned);

      // Group assigned players by team
      const rosterMap: Record<string, Player[]> = {};
      data.forEach(t => {
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

  const handleTeamLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setTeamLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setTeamLogoPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handlePlayerPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPlayerPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setPlayerPhotoPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName) return;
    setTeamLoading(true);

    try {
      let logoUrl = '';
      if (teamLogoFile) {
        logoUrl = await db.uploadFile('logos', teamLogoFile);
      }

      await db.registerTeam({
        tournament_id: tournament.id,
        name: teamName,
        logo_url: logoUrl || undefined,
        color_hex: teamColor,
        nation: teamNation || undefined,
      });

      setTeamName('');
      setTeamNation('');
      setTeamLogoFile(null);
      setTeamLogoPreview('');
      loadTeamsAndPlayers();
      onTeamsUpdated?.();
    } catch (err) {
      console.error(err);
    } finally {
      setTeamLoading(false);
    }
  };

  const handleAddPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName || (isAdmin && !selectedTeamId)) return;
    setPlayerLoading(true);

    try {
      let photoUrl = '';
      if (playerPhotoFile) {
        photoUrl = await db.uploadFile('players', playerPhotoFile);
      }

      const player = await db.registerPlayer({
        tournament_id: tournament.id,
        team_id: isAdmin ? selectedTeamId : undefined,
        name: playerName,
        photo_url: photoUrl || undefined,
        role: isAdmin ? playerRole : 'Player',
        user_id: session?.user?.id || undefined,
      });

      if (isAdmin && makeCaptain && selectedTeamId) {
        await db.updateTeamCaptain(selectedTeamId, player.id);
      }

      setPlayerName('');
      setPlayerPhotoFile(null);
      setPlayerPhotoPreview('');
      setMakeCaptain(false);
      loadTeamsAndPlayers();
      onTeamsUpdated?.();
    } catch (err) {
      console.error(err);
    } finally {
      setPlayerLoading(false);
    }
  };

  const roles = ['Goalkeeper', 'Defender', 'Midfielder', 'Forward'];

  return (
    <div className="w-full space-y-8">
      {/* Tournament Registry Status Card */}
      <div className="bg-surface/30 border border-white/5 rounded-3xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <Avatar src={tournament.logo_url} name={tournament.name} size="lg" shape="square" colorHex="#FACC15" />
          <div>
            <span className="px-2 py-0.5 bg-accent-gold/10 border border-accent-gold/20 text-accent-gold text-[10px] uppercase font-bold tracking-wider rounded">
              Registry Phase
            </span>
            <h2 className="text-xl font-display font-bold text-foreground mt-1">{tournament.name}</h2>
            <p className="text-xs text-nebula-gray">
              Sport: <span className="text-foreground capitalize">{tournament.sport_type}</span> • Format: <span className="text-foreground capitalize">{tournament.format}</span>
            </p>
          </div>
        </div>

        {isAdmin ? (
          teams.length >= 2 ? (
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
                [LOCKED] Requires minimum 2 teams
              </span>
              <span className="text-[10px] text-nebula-gray block mt-0.5">
                Register teams and players to begin the schedule.
              </span>
            </div>
          )
        ) : (
          <div className="text-right">
            <span className="text-xs text-nebula-gray font-mono font-medium block">
              Join a Team to participate
            </span>
          </div>
        )}
      </div>

      <div className={`grid grid-cols-1 ${isAdmin ? 'lg:grid-cols-3' : 'lg:grid-cols-2 lg:max-w-4xl mx-auto'} gap-8`}>
        {/* Registration Forms panel */}
        <div className="bg-surface/50 border border-white/5 rounded-3xl p-6 h-fit space-y-6">
          {isAdmin && (
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
              disabled={teams.length === 0}
              onClick={() => setActiveTab('players')}
              className={`flex-1 py-2.5 text-center text-xs font-bold rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
                activeTab === 'players' ? 'bg-surface text-accent-gold shadow-md' : 'text-nebula-gray hover:text-foreground'
              }`}
            >
              Add Players
            </button>
          </div>
          )}

          {(activeTab === 'teams' && isAdmin) ? (
            <form onSubmit={handleCreateTeam} className="space-y-5">
              <h3 className="font-display font-semibold text-base flex items-center gap-2">
                <Plus className="w-5 h-5 text-accent-gold" /> Add Competitive Faction
              </h3>

              <div>
                <label className="block text-[10px] uppercase tracking-wider text-nebula-gray mb-1.5 font-bold">Team Name</label>
                <input
                  type="text"
                  required
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="e.g., Solar Striker FC"
                  className="w-full bg-background border border-white/5 focus:border-accent-gold/40 focus:ring-1 focus:ring-accent-gold/40 rounded-xl px-4 py-3 text-sm outline-none transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-nebula-gray mb-1.5 font-bold">Jersey Color</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={teamColor}
                      onChange={(e) => setTeamColor(e.target.value)}
                      className="w-12 h-10 bg-background rounded-lg border border-white/5 cursor-pointer p-1"
                    />
                    <span className="text-xs font-mono">{teamColor.toUpperCase()}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-nebula-gray mb-1.5 font-bold">Nation (Flag)</label>
                  <select
                    value={teamNation}
                    onChange={(e) => setTeamNation(e.target.value)}
                    className="w-full bg-background border border-white/5 focus:border-accent-gold/40 rounded-xl px-3 py-2 text-xs outline-none transition-all text-foreground"
                  >
                    <option value="">None</option>
                    <option value="BR">🇧🇷 Brazil</option>
                    <option value="DE">🇩🇪 Germany</option>
                    <option value="ES">🇪🇸 Spain</option>
                    <option value="IT">🇮🇹 Italy</option>
                    <option value="FR">🇫🇷 France</option>
                    <option value="PT">🇵🇹 Portugal</option>
                    <option value="GB">🏴󠁧󠁢󠁥󠁮󠁧󠁿 England</option>
                    <option value="NL">🇳🇱 Netherlands</option>
                    <option value="AR">🇦🇷 Argentina</option>
                    <option value="US">🇺🇸 United States</option>
                    <option value="JP">🇯🇵 Japan</option>
                    <option value="KR">🇰🇷 South Korea</option>
                    <option value="IN">🇮🇳 India</option>
                    <option value="MX">🇲🇽 Mexico</option>
                    <option value="NG">🇳🇬 Nigeria</option>
                    <option value="CM">🇨🇲 Cameroon</option>
                    <option value="EG">🇪🇬 Egypt</option>
                    <option value="AU">🇦🇺 Australia</option>
                    <option value="BE">🇧🇪 Belgium</option>
                    <option value="HR">🇭🇷 Croatia</option>
                    <option value="SE">🇸🇪 Sweden</option>
                    <option value="TR">🇹🇷 Turkey</option>
                    <option value="RU">🇷🇺 Russia</option>
                    <option value="CN">🇨🇳 China</option>
                    <option value="MA">🇲🇦 Morocco</option>
                    <option value="SN">🇸🇳 Senegal</option>
                    <option value="SA">🇸🇦 Saudi Arabia</option>
                    <option value="PK">🇵🇰 Pakistan</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-wider text-nebula-gray mb-1.5 font-bold">Team Logo</label>
                <div className="flex items-center gap-4">
                  {teamLogoPreview ? (
                    <Avatar src={teamLogoPreview} name={teamName || 'T'} size="md" shape="square" colorHex={teamColor} />
                  ) : (
                    <div className="w-12 h-12 rounded-lg border border-dashed border-white/10 flex items-center justify-center text-nebula-gray bg-background">
                      <Shield className="w-5 h-5 opacity-40" />
                    </div>
                  )}
                  <label className="flex items-center gap-2 cursor-pointer bg-surface hover:bg-surface-hover border border-white/5 hover:border-white/10 rounded-xl px-4 py-2.5 text-xs font-bold text-foreground transition-all">
                    <Upload className="w-4 h-4 text-accent-gold" />
                    <span>Upload</span>
                    <input type="file" accept="image/*" className="hidden" onChange={handleTeamLogoChange} />
                  </label>
                </div>
              </div>

              <button
                type="submit"
                disabled={teamLoading}
                className="w-full py-3 bg-accent-gold hover:bg-yellow-400 text-background rounded-xl text-xs font-extrabold tracking-wider uppercase transition-all shadow-[0_0_10px_rgba(250,204,21,0.1)]"
              >
                {teamLoading ? 'Registering...' : 'Register Team'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleAddPlayer} className="space-y-5">
              <h3 className="font-display font-semibold text-base flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-accent-cyan" /> {isAdmin ? 'Recruits & Roster' : 'Join the Player Pool'}
              </h3>

              {isAdmin && (
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-nebula-gray mb-1.5 font-bold">Assign to Team</label>
                  <select
                    value={selectedTeamId}
                    onChange={(e) => setSelectedTeamId(e.target.value)}
                    className="w-full bg-background border border-white/5 focus:border-accent-cyan/40 rounded-xl px-3 py-2.5 text-sm outline-none transition-all text-foreground"
                  >
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-[10px] uppercase tracking-wider text-nebula-gray mb-1.5 font-bold">Your Name</label>
                <input
                  type="text"
                  required
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder={isAdmin ? "e.g., Kakarot" : "Enter your full name"}
                  className="w-full bg-background border border-white/5 focus:border-accent-cyan/40 focus:ring-1 focus:ring-accent-cyan/40 rounded-xl px-4 py-3 text-sm outline-none transition-all"
                />
              </div>

              {isAdmin && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider text-nebula-gray mb-1.5 font-bold">Role</label>
                    <select
                      value={playerRole}
                      onChange={(e) => setPlayerRole(e.target.value)}
                      className="w-full bg-background border border-white/5 focus:border-accent-cyan/40 rounded-xl px-3 py-2.5 text-xs outline-none transition-all text-foreground"
                    >
                      {roles.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-end pb-1">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={makeCaptain}
                        onChange={(e) => setMakeCaptain(e.target.checked)}
                        className="w-4 h-4 bg-background border-white/10 rounded accent-accent-cyan cursor-pointer"
                      />
                      <span className="text-xs text-nebula-gray">Team Captain</span>
                    </label>
                  </div>
                </div>
              )}

              {isAdmin && (
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-nebula-gray mb-1.5 font-bold">Player Photo</label>
                  <div className="flex items-center gap-4">
                    {playerPhotoPreview ? (
                      <Avatar src={playerPhotoPreview} name={playerName || 'P'} size="md" shape="circle" />
                    ) : (
                      <div className="w-12 h-12 rounded-full border border-dashed border-white/10 flex items-center justify-center text-nebula-gray bg-background">
                        <Users className="w-5 h-5 opacity-40" />
                      </div>
                    )}
                    <label className="flex items-center gap-2 cursor-pointer bg-surface hover:bg-surface-hover border border-white/5 hover:border-white/10 rounded-xl px-4 py-2.5 text-xs font-bold text-foreground transition-all">
                      <Upload className="w-4 h-4 text-accent-cyan" />
                      <span>Upload</span>
                      <input type="file" accept="image/*" className="hidden" onChange={handlePlayerPhotoChange} />
                    </label>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={playerLoading}
                className="w-full py-3 bg-accent-cyan hover:bg-cyan-400 text-background rounded-xl text-xs font-extrabold tracking-wider uppercase transition-all shadow-[0_0_10px_rgba(34,211,238,0.1)]"
              >
                {playerLoading ? 'Processing...' : isAdmin ? 'Add Player' : 'Join Team'}
              </button>
            </form>
          )}
          </div>

        {/* Registered Factions Display */}
        <div className={`${isAdmin ? 'lg:col-span-2' : 'lg:col-span-2'} space-y-8`}>
          {/* Draft Pool (Unassigned Players) - Admin Only */}
          {isAdmin && (

            <div className="bg-surface/30 border border-white/5 rounded-3xl p-6 space-y-4">
              <div className="flex justify-between items-center border-b border-white/5 pb-3">
                <h3 className="font-display font-bold text-base text-foreground flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-accent-cyan" /> Draft Pool / Unassigned ({unassignedPlayers.length})
                </h3>
                <span className="text-[10px] text-nebula-gray font-mono uppercase">Needs Team Assignment</span>
              </div>
              {unassignedPlayers.length === 0 ? (
                <p className="text-xs text-nebula-gray italic py-2">All players have been assigned to teams.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-72 overflow-y-auto pr-1">
                  {unassignedPlayers.map((player) => (
                    <div key={player.id} className="flex items-center justify-between p-3 bg-background/50 rounded-xl border border-white/5 hover:border-white/10 transition-all">
                      <div className="flex items-center gap-2.5">
                        <Avatar src={player.photo_url} name={player.name} size="xs" />
                        <div>
                          <span className="text-xs text-foreground font-semibold block">{player.name}</span>
                          <span className="text-[9px] bg-white/5 px-1.5 py-0.5 rounded text-nebula-gray uppercase tracking-wider font-mono">POOL</span>
                        </div>
                      </div>
                      <select
                        onChange={async (e) => {
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
                        <option value="" disabled>Assign Team...</option>
                        {teams.map((t) => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-between items-center">
            <h3 className="font-display font-bold text-lg text-foreground flex items-center gap-2">
              <Users className="w-5 h-5 text-accent-gold" /> Competitors Factions ({teams.length})
            </h3>
            <span className="text-xs text-nebula-gray">Standings initialized upon launch</span>
          </div>

          {teams.length === 0 ? (
            <div className="border border-dashed border-white/5 rounded-3xl p-12 text-center text-nebula-gray bg-surface/20">
              <Shield className="w-12 h-12 mx-auto text-white/10 mb-4" />
              <p className="font-display text-sm font-semibold text-foreground">No factions registered yet</p>
              <p className="text-xs text-nebula-gray mt-1 max-w-xs mx-auto">
                Begin registering teams and captains to forge the brackets.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {teams.map((t) => {
                const teamRoster = rosters[t.id] || [];
                const captain = teamRoster.find(p => p.id === t.captain_id);

                return (
                  <div key={t.id} className="bg-surface/40 border border-white/5 rounded-2xl p-5 hover:border-white/10 transition-all flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Avatar src={t.logo_url} name={t.name} size="md" shape="square" colorHex={t.color_hex} />
                          <div>
                            <h4 className="font-display font-semibold text-sm text-foreground">{t.name}</h4>
                            {captain && (
                              <span className="text-[10px] text-accent-gold flex items-center gap-1 mt-0.5">
                                <Trophy className="w-3 h-3" /> Captain: {captain.name}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="w-5 h-5 rounded-full border border-white/10" style={{ backgroundColor: t.color_hex }} />
                      </div>

                      {/* Roster list */}
                      <div className="mt-5 border-t border-white/5 pt-4">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-[10px] uppercase font-bold tracking-widest text-nebula-gray">Roster ({teamRoster.length})</span>
                        </div>
                        {teamRoster.length === 0 ? (
                          <p className="text-[10px] text-nebula-gray italic">No players registered on team</p>
                        ) : (
                          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                            {teamRoster.map((player) => (
                              <div key={player.id} className="flex items-center justify-between p-1.5 bg-background/50 rounded-lg border border-white/5">
                                <div className="flex items-center gap-2">
                                  <Avatar src={player.photo_url} name={player.name} size="xs" colorHex={t.color_hex} />
                                  <span className="text-xs text-foreground font-medium">{player.name}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[9px] bg-surface text-nebula-gray px-1.5 py-0.5 rounded font-mono uppercase tracking-wide">
                                    {player.role.substring(0, 3)}
                                  </span>
                                  {t.captain_id === player.id && (
                                    <span className="text-[9px] bg-accent-gold/20 text-accent-gold px-1.5 py-0.5 rounded font-mono font-bold uppercase tracking-wide">
                                      CPT
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
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
