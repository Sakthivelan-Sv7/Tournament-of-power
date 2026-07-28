import { supabase } from './supabaseClient';

// Sport profile type definition
export interface SportProfile {
  sport_type: string;
  event_type_config_jsonb: {
    display_name: string;
    events: Record<string, {
      label: string;
      requires_player: boolean;
      has_assister: boolean;
      affects_score: boolean;
      value_type?: 'percentage' | 'integer';
    }>;
    standings_columns: string[];
    scoring_events: string[];
  };
}

// Tournament type definition
export interface Tournament {
  id: string;
  name: string;
  logo_url?: string;
  organizer_id?: string;
  sport_type: string;
  format: string; // 'league', 'knockout', 'hybrid'
  start_date: string;
  end_date: string;
  status: 'draft' | 'active' | 'completed';
  created_at?: string;
}

// Team type definition
export interface Team {
  id: string;
  tournament_id: string;
  name: string;
  logo_url?: string;
  color_hex: string;
  captain_id?: string;
  nation?: string; // ISO 3166-1 alpha-2 country code e.g. 'BR', 'DE'
  status?: 'pending' | 'accepted' | 'rejected';
}

// Player type definition
export interface Player {
  id: string;
  team_id?: string;
  name: string;
  photo_url?: string;
  role: string;
  user_id?: string;
  tournament_id?: string;
}

// Poll interfaces
export interface Poll {
  id: string;
  question: string;
  options: string[];
  created_by: string;
  created_at: string;
}

export interface PollVote {
  id: string;
  poll_id: string;
  user_id: string;
  option: string;
  created_at: string;
}


export interface Profile {
  id: string;
  role: 'admin' | 'user';
  email?: string; // added for admin list
  created_at?: string;
}

// Match type definition
export interface Match {
  id: string;
  tournament_id: string;
  round_name: string;
  team_a_id: string;
  team_b_id: string;
  status: 'scheduled' | 'in_progress' | 'completed';
  scheduled_at: string;
  metadata_jsonb?: Record<string, any>;
  team_a_score?: number; // computed
  team_b_score?: number; // computed
}

// Match Event type definition
export interface MatchEvent {
  id: string;
  match_id: string;
  player_id?: string;
  team_id?: string;
  event_type: string;
  minute?: number;
  metadata_jsonb?: Record<string, any>;
}

// Standings row type definition
export interface StandingsRow {
  tournament_id: string;
  team_id: string;
  team_name: string;
  logo_url?: string;
  color_hex: string;
  nation?: string;
  mp: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  gd: number;
  pts: number;
  rank: number;
}

// Football configuration seed data (fallback)
const FOOTBALL_PROFILE: SportProfile = {
  sport_type: 'football',
  event_type_config_jsonb: {
    display_name: 'Football',
    events: {
      goal: { label: 'Goal', requires_player: true, has_assister: true, affects_score: true },
      own_goal: { label: 'Own Goal', requires_player: true, has_assister: false, affects_score: true },
      yellow_card: { label: 'Yellow Card', requires_player: true, has_assister: false, affects_score: false },
      red_card: { label: 'Red Card', requires_player: true, has_assister: false, affects_score: false },
      possession: { label: 'Possession %', requires_player: false, has_assister: false, affects_score: false, value_type: 'percentage' },
      shots: { label: 'Shots on Target', requires_player: false, has_assister: false, affects_score: false, value_type: 'integer' },
      clean_sheet: { label: 'Clean Sheet', requires_player: true, has_assister: false, affects_score: false },
      mvp: { label: 'Man of the Match', requires_player: true, has_assister: false, affects_score: false }
    },
    standings_columns: ['MP', 'W', 'D', 'L', 'GF', 'GA', 'GD', 'PTS'],
    scoring_events: ['goal', 'own_goal']
  }
};

// Check if supabase is fully configured
export const isSupabaseConfigured = (): boolean => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return !!url && url !== 'your-supabase-project-url' && !!key && key !== 'your-supabase-anon-key';
};

// Local storage helper functions
const getLocal = <T>(key: string, fallback: T): T => {
  if (typeof window === 'undefined') return fallback;
  const item = localStorage.getItem(key);
  return item ? JSON.parse(item) : fallback;
};

const setLocal = (key: string, value: any) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(value));
};

// Data service layer
export const db = {
  isSupabaseConfigured() {
    return isSupabaseConfigured();
  },

  // Sport Profiles
  async getSportProfiles(): Promise<SportProfile[]> {
    if (isSupabaseConfigured()) {
      const { data, error } = await supabase.from('sport_profiles').select('*');
      if (!error && data) return data as SportProfile[];
    }
    // Local fallback
    const profiles = getLocal<SportProfile[]>('top_sport_profiles', [FOOTBALL_PROFILE]);
    return profiles;
  },

  // Tournaments
  async createTournament(tournament: Omit<Tournament, 'id' | 'status'>): Promise<Tournament> {
    const newTournament: Tournament = {
      ...tournament,
      id: crypto.randomUUID(),
      status: 'draft',
      created_at: new Date().toISOString()
    };

    if (isSupabaseConfigured()) {
      const { data, error } = await supabase.from('tournaments').insert([newTournament]).select().single();
      if (!error && data) return data as Tournament;
      console.error("Supabase createTournament error, falling back to local:", error);
    }

    const tournaments = getLocal<Tournament[]>('top_tournaments', []);
    tournaments.push(newTournament);
    setLocal('top_tournaments', tournaments);
    return newTournament;
  },

  async getTournaments(): Promise<Tournament[]> {
    if (isSupabaseConfigured()) {
      const { data, error } = await supabase.from('tournaments').select('*').order('created_at', { ascending: false });
      if (!error && data) return data as Tournament[];
    }
    return getLocal<Tournament[]>('top_tournaments', []);
  },

  async getTournament(id: string): Promise<Tournament | null> {
    if (isSupabaseConfigured()) {
      const { data, error } = await supabase.from('tournaments').select('*').eq('id', id).maybeSingle();
      if (!error && data) return data as Tournament;
    }
    const tournaments = getLocal<Tournament[]>('top_tournaments', []);
    return tournaments.find(t => t.id === id) || null;
  },

  async updateTournamentStatus(id: string, status: Tournament['status']): Promise<void> {
    if (isSupabaseConfigured()) {
      await supabase.from('tournaments').update({ status }).eq('id', id);
    }
    const tournaments = getLocal<Tournament[]>('top_tournaments', []);
    const idx = tournaments.findIndex(t => t.id === id);
    if (idx !== -1) {
      tournaments[idx].status = status;
      setLocal('top_tournaments', tournaments);
    }
  },

  // Teams
  async registerTeam(team: Omit<Team, 'id' | 'status'>): Promise<Team> {
    const newTeam: Team = {
      ...team,
      id: crypto.randomUUID(),
      status: 'pending'
    };

    if (isSupabaseConfigured()) {
      const { data, error } = await supabase.from('teams').insert([newTeam]).select().single();
      if (!error && data) return data as Team;
      console.error("Supabase registerTeam error:", error);
    }

    const teams = getLocal<Team[]>('top_teams', []);
    teams.push(newTeam);
    setLocal('top_teams', teams);
    return newTeam;
  },

  async getTeams(tournamentId: string, status?: 'pending' | 'accepted' | 'rejected'): Promise<Team[]> {
    if (isSupabaseConfigured()) {
      let query = supabase.from('teams').select('*').eq('tournament_id', tournamentId);
      if (status) query = query.eq('status', status);
      const { data, error } = await query;
      if (!error && data) return data as Team[];
    }
    const teams = getLocal<Team[]>('top_teams', []);
    return teams.filter(t => t.tournament_id === tournamentId && (!status || t.status === status));
  },

  async updateTeamStatus(teamId: string, status: 'pending' | 'accepted' | 'rejected'): Promise<void> {
    if (isSupabaseConfigured()) {
      await supabase.from('teams').update({ status }).eq('id', teamId);
    }
    const teams = getLocal<Team[]>('top_teams', []);
    const idx = teams.findIndex(t => t.id === teamId);
    if (idx !== -1) {
      teams[idx].status = status;
      setLocal('top_teams', teams);
    }
  },

  async updateTeamCaptain(teamId: string, captainId: string): Promise<void> {
    if (isSupabaseConfigured()) {
      await supabase.from('teams').update({ captain_id: captainId }).eq('id', teamId);
    }
    const teams = getLocal<Team[]>('top_teams', []);
    const idx = teams.findIndex(t => t.id === teamId);
    if (idx !== -1) {
      teams[idx].captain_id = captainId;
      setLocal('top_teams', teams);
    }
  },

  // Players
  async registerPlayer(player: Omit<Player, 'id'>): Promise<Player> {
    const newPlayer: Player = {
      ...player,
      id: crypto.randomUUID()
    };

    if (isSupabaseConfigured()) {
      const { data, error } = await supabase.from('players').insert([newPlayer]).select().single();
      if (!error && data) return data as Player;
    }

    const players = getLocal<Player[]>('top_players', []);
    players.push(newPlayer);
    setLocal('top_players', players);
    return newPlayer;
  },

  async getPlayers(teamId: string): Promise<Player[]> {
    if (isSupabaseConfigured()) {
      const { data, error } = await supabase.from('players').select('*').eq('team_id', teamId);
      if (!error && data) return data as Player[];
    }
    const players = getLocal<Player[]>('top_players', []);
    return players.filter(p => p.team_id === teamId);
  },

  async getTournamentPlayers(tournamentId: string): Promise<Player[]> {
    if (isSupabaseConfigured()) {
      const { data, error } = await supabase.from('players').select('*').eq('tournament_id', tournamentId);
      if (!error && data) return data as Player[];
    }
    // Local fallback
    const players = getLocal<Player[]>('top_players', []);
    return players.filter(p => p.tournament_id === tournamentId);
  },

  async assignPlayerToTeam(playerId: string, teamId: string | null): Promise<void> {
    if (isSupabaseConfigured()) {
      await supabase.from('players').update({ team_id: teamId }).eq('id', playerId);
    }
    const players = getLocal<Player[]>('top_players', []);
    const idx = players.findIndex(p => p.id === playerId);
    if (idx !== -1) {
      players[idx].team_id = teamId || undefined;
      setLocal('top_players', players);
    }
  },

  // Matches
  async createMatches(matchesList: Omit<Match, 'id' | 'status'>[]): Promise<Match[]> {
    const newMatches: Match[] = matchesList.map(m => ({
      ...m,
      id: crypto.randomUUID(),
      status: 'scheduled',
      metadata_jsonb: m.metadata_jsonb || {}
    }));

    if (isSupabaseConfigured()) {
      const { data, error } = await supabase.from('matches').insert(newMatches).select();
      if (!error && data) return data as Match[];
    }

    const matches = getLocal<Match[]>('top_matches', []);
    matches.push(...newMatches);
    setLocal('top_matches', matches);
    return newMatches;
  },

  async getMatches(tournamentId: string): Promise<Match[]> {
    let rawMatches: Match[] = [];
    if (isSupabaseConfigured()) {
      const { data, error } = await supabase.from('matches').select('*').eq('tournament_id', tournamentId).order('scheduled_at', { ascending: true });
      if (!error && data) {
        rawMatches = data as Match[];
      }
    } else {
      const matches = getLocal<Match[]>('top_matches', []);
      rawMatches = matches.filter(m => m.tournament_id === tournamentId);
    }

    // Populate dynamic scores from events
    const populated = await Promise.all(rawMatches.map(async (m) => {
      const scores = await this.computeMatchScore(m.id, m.team_a_id, m.team_b_id);
      return {
        ...m,
        team_a_score: scores.team_a_score,
        team_b_score: scores.team_b_score
      };
    }));
    return populated;
  },

  async getMatch(matchId: string): Promise<Match | null> {
    let m: Match | null = null;
    if (isSupabaseConfigured()) {
      const { data, error } = await supabase.from('matches').select('*').eq('id', matchId).maybeSingle();
      if (!error && data) m = data as Match;
    } else {
      const matches = getLocal<Match[]>('top_matches', []);
      m = matches.find(x => x.id === matchId) || null;
    }

    if (m) {
      const scores = await this.computeMatchScore(m.id, m.team_a_id, m.team_b_id);
      m.team_a_score = scores.team_a_score;
      m.team_b_score = scores.team_b_score;
    }
    return m;
  },

  async updateMatchStatus(matchId: string, status: Match['status']): Promise<void> {
    if (isSupabaseConfigured()) {
      await supabase.from('matches').update({ status }).eq('id', matchId);
    }
    const matches = getLocal<Match[]>('top_matches', []);
    const idx = matches.findIndex(m => m.id === matchId);
    if (idx !== -1) {
      matches[idx].status = status;
      setLocal('top_matches', matches);
    }
  },

  async clearMatches(tournamentId: string): Promise<void> {
    if (isSupabaseConfigured()) {
      await supabase.from('matches').delete().eq('tournament_id', tournamentId);
    }
    const matches = getLocal<Match[]>('top_matches', []);
    const filtered = matches.filter(m => m.tournament_id !== tournamentId);
    setLocal('top_matches', filtered);
  },

  // Match Events
  async addMatchEvent(event: Omit<MatchEvent, 'id'>): Promise<MatchEvent> {
    const newEvent: MatchEvent = {
      ...event,
      id: crypto.randomUUID()
    };

    if (isSupabaseConfigured()) {
      const { data, error } = await supabase.from('match_events').insert([newEvent]).select().single();
      if (!error && data) return data as MatchEvent;
    }

    const events = getLocal<MatchEvent[]>('top_match_events', []);
    events.push(newEvent);
    setLocal('top_match_events', events);
    return newEvent;
  },

  async getMatchEvents(matchId: string): Promise<MatchEvent[]> {
    if (isSupabaseConfigured()) {
      const { data, error } = await supabase.from('match_events').select('*').eq('match_id', matchId).order('minute', { ascending: true });
      if (!error && data) return data as MatchEvent[];
    }
    const events = getLocal<MatchEvent[]>('top_match_events', []);
    return events.filter(e => e.match_id === matchId).sort((a, b) => (a.minute || 0) - (b.minute || 0));
  },

  async deleteMatch(id: string): Promise<void> {
    const { error } = await supabase.from('matches').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  async getProfile(userId: string): Promise<Profile | null> {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (error) {
      if (error.code === 'PGRST116') return null; // No rows found
      throw new Error(error.message);
    }
    return data;
  },

  async deleteMatchEvent(eventId: string): Promise<void> {
    if (isSupabaseConfigured()) {
      await supabase.from('match_events').delete().eq('id', eventId);
    }
    const events = getLocal<MatchEvent[]>('top_match_events', []);
    const filtered = events.filter(e => e.id !== eventId);
    setLocal('top_match_events', filtered);
  },

  async computeMatchScore(matchId: string, teamAId: string, teamBId: string): Promise<{ team_a_score: number, team_b_score: number }> {
    let events: MatchEvent[] = [];
    if (isSupabaseConfigured()) {
      const { data, error } = await supabase.from('match_events').select('*').eq('match_id', matchId);
      if (!error && data) events = data as MatchEvent[];
    } else {
      const allEvents = getLocal<MatchEvent[]>('top_match_events', []);
      events = allEvents.filter(e => e.match_id === matchId);
    }

    let team_a_score = 0;
    let team_b_score = 0;

    events.forEach(e => {
      if (e.event_type === 'goal') {
        if (e.team_id === teamAId) team_a_score++;
        else if (e.team_id === teamBId) team_b_score++;
      } else if (e.event_type === 'own_goal') {
        // Own goal goes to the opposite team
        if (e.team_id === teamAId) team_b_score++;
        else if (e.team_id === teamBId) team_a_score++;
      }
    });

    return { team_a_score, team_b_score };
  },

  // Computed Standings
  async getStandings(tournamentId: string): Promise<StandingsRow[]> {
    if (isSupabaseConfigured()) {
      const { data, error } = await supabase.from('standings_computed').select('*').eq('tournament_id', tournamentId).order('rank', { ascending: true });
      if (!error && data) return data as StandingsRow[];
    }

    // Local computed standings fallback
    const tournaments = getLocal<Tournament[]>('top_tournaments', []);
    const t = tournaments.find(x => x.id === tournamentId);
    if (!t) return [];

    const teams = getLocal<Team[]>('top_teams', []).filter(x => x.tournament_id === tournamentId);
    const allMatches = getLocal<Match[]>('top_matches', []).filter(x => x.tournament_id === tournamentId);
    const allEvents = getLocal<MatchEvent[]>('top_match_events', []);

    // Calculate match scores
    const matchScores = allMatches.map(m => {
      const events = allEvents.filter(e => e.match_id === m.id);
      let team_a_score = 0;
      let team_b_score = 0;
      events.forEach(e => {
        if (e.event_type === 'goal') {
          if (e.team_id === m.team_a_id) team_a_score++;
          else if (e.team_id === m.team_b_id) team_b_score++;
        } else if (e.event_type === 'own_goal') {
          if (e.team_id === m.team_a_id) team_b_score++;
          else if (e.team_id === m.team_b_id) team_a_score++;
        }
      });
      return { ...m, team_a_score, team_b_score };
    });

    // Aggregate stats per team
    const stats: Record<string, Omit<StandingsRow, 'rank'>> = {};
    teams.forEach(team => {
      stats[team.id] = {
        tournament_id: tournamentId,
        team_id: team.id,
        team_name: team.name,
        logo_url: team.logo_url,
        color_hex: team.color_hex,
        nation: team.nation,
        mp: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0
      };
    });

    matchScores.forEach(m => {
      if (m.status !== 'completed') return;

      const teamA = stats[m.team_a_id];
      const teamB = stats[m.team_b_id];

      if (!teamA || !teamB) return;

      teamA.mp++;
      teamB.mp++;
      teamA.gf += m.team_a_score;
      teamB.gf += m.team_b_score;
      teamA.ga += m.team_b_score;
      teamB.ga += m.team_a_score;

      if (m.team_a_score > m.team_b_score) {
        teamA.w++;
        teamA.pts += 3;
        teamB.l++;
      } else if (m.team_a_score < m.team_b_score) {
        teamB.w++;
        teamB.pts += 3;
        teamA.l++;
      } else {
        teamA.d++;
        teamA.pts += 1;
        teamB.d++;
        teamB.pts += 1;
      }
    });

    // Calculate GD & sort
    const rows = Object.values(stats).map(s => ({
      ...s,
      gd: s.gf - s.ga
    }));

    rows.sort((a, b) => {
      if (b.pts !== a.pts) return b.pts - a.pts;
      if (b.gd !== a.gd) return b.gd - a.gd;
      if (b.gf !== a.gf) return b.gf - a.gf;
      return a.team_name.localeCompare(b.team_name);
    });

    return rows.map((r, idx) => ({ ...r, rank: idx + 1 }));
  },

  // File Upload Helper (Storage)
  async uploadFile(bucket: string, file: File): Promise<string> {
    const fileExt = file.name.split('.').pop();
    const fileName = `${crypto.randomUUID()}.${fileExt}`;
    const filePath = `${fileName}`;

    if (isSupabaseConfigured()) {
      const { data, error } = await supabase.storage.from(bucket).upload(filePath, file);
      if (!error && data) {
        const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(filePath);
        return publicUrl;
      }
      console.error("Supabase storage upload error:", error);
    }

    // Local Storage Mock Upload (Base64 data url)
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve(reader.result as string);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },

  // Admin Management
  async makeAdmin(email: string): Promise<boolean> {
    if (!isSupabaseConfigured()) {
      console.warn("Admin management requires Supabase to be configured.");
      return false;
    }
    const { data, error } = await supabase.rpc('make_admin_by_email', { target_email: email });
    if (error) {
      console.error('Error making user admin:', error);
      return false;
    }
    return !!data;
  },

  async getAdmins(): Promise<Profile[]> {
    if (!isSupabaseConfigured()) return [];
    const { data, error } = await supabase.rpc('get_admins');
    if (error) {
      console.error('Error fetching admins:', error);
      return [];
    }
    return data as Profile[];
  },

  async removeAdmin(email: string): Promise<boolean> {
    if (!isSupabaseConfigured()) return false;
    const { data, error } = await supabase.rpc('remove_admin', { target_email: email });
    if (error) {
      console.error('Error removing admin:', error);
      return false;
    }
    return !!data;
  }
};
