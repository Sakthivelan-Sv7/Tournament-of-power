import { Match, Team, db } from './db';

/**
 * Generate League fixtures (Round-robin)
 */
export function generateRoundRobinFixtures(
  tournamentId: string,
  teams: Team[],
  doubleRoundRobin = false
): Omit<Match, 'id' | 'status'>[] {
  if (teams.length < 2) return [];

  const list = [...teams];
  const isOdd = list.length % 2 !== 0;
  if (isOdd) {
    // Add a placeholder dummy team for BYEs
    list.push({ id: 'BYE', name: 'BYE', tournament_id: tournamentId, color_hex: '' });
  }

  const numTeams = list.length;
  const rounds = numTeams - 1;
  const half = numTeams / 2;
  const fixtures: Omit<Match, 'id' | 'status'>[] = [];

  const fixed = list[0];
  const rotating = list.slice(1);

  for (let r = 0; r < rounds; r++) {
    const roundName = `Round ${r + 1}`;
    const roundTeams = [fixed, ...rotating];

    for (let i = 0; i < half; i++) {
      const home = roundTeams[i];
      const away = roundTeams[numTeams - 1 - i];

      if (home.id !== 'BYE' && away.id !== 'BYE') {
        const scheduledTime = new Date();
        scheduledTime.setDate(scheduledTime.getDate() + r); // Incremented days for spacing
        scheduledTime.setHours(18, 0, 0, 0); // Default to 6:00 PM

        fixtures.push({
          tournament_id: tournamentId,
          round_name: roundName,
          team_a_id: home.id,
          team_b_id: away.id,
          scheduled_at: scheduledTime.toISOString(),
          metadata_jsonb: {
            round_index: r
          }
        });
      }
    }

    // Rotate array: move last element to the front
    rotating.unshift(rotating.pop()!);
  }

  if (doubleRoundRobin) {
    const returnFixtures = fixtures.map(f => {
      const scheduledTime = new Date(f.scheduled_at);
      scheduledTime.setDate(scheduledTime.getDate() + rounds); // Scheduled in subsequent weeks/days
      const rNum = parseInt(f.round_name.replace('Round ', ''), 10);

      return {
        ...f,
        round_name: `Round ${rNum + rounds}`,
        team_a_id: f.team_b_id,
        team_b_id: f.team_a_id,
        scheduled_at: scheduledTime.toISOString(),
        metadata_jsonb: {
          round_index: (f.metadata_jsonb?.round_index || 0) + rounds
        }
      };
    });
    fixtures.push(...returnFixtures);
  }

  // Sort fixtures chronologically by scheduled date
  return fixtures.sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
}

/**
 * Randomly assign teams to groups using Fisher-Yates shuffle.
 * @param teams List of accepted teams
 * @param groupSize Number of teams per group (default 4)
 * @returns Array of objects containing teamId and assigned groupName
 */
/**
 * Randomly assign teams to groups using Fisher-Yates shuffle.
 * Distributes accepted teams evenly across target number of groups (default 4: Group A, B, C, D)
 * @param teams List of accepted teams
 * @param groupSize Preferred group size or number of groups
 * @returns Array of objects containing teamId and assigned groupName
 */
export function assignTeamsToGroups(
  teams: Team[],
  groupSize: number = 4
): { teamId: string; groupName: string }[] {
  if (teams.length === 0) return [];

  // Fisher-Yates shuffle
  const shuffled = [...teams];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const numGroups = 4; // Target 4 groups: Group A, Group B, Group C, Group D
  const groupNames = Array.from({ length: numGroups }, (_, i) => `Group ${String.fromCharCode(65 + i)}`);

  const assignments: { teamId: string; groupName: string }[] = [];

  shuffled.forEach((team, index) => {
    const groupName = groupNames[index % numGroups];
    assignments.push({ teamId: team.id, groupName });
  });

  return assignments;
}

/**
 * Generate Knockout Round 1 matches
 * Pairs teams in order of registration or randomized
 */
export function generateKnockoutRound1(
  tournamentId: string,
  teams: Team[],
  size: 2 | 4 | 8 | 16
): Omit<Match, 'id' | 'status'>[] {
  const selectedTeams = teams.slice(0, size);
  // Pad with byes or fill if not enough teams
  while (selectedTeams.length < size) {
    selectedTeams.push({
      id: `placeholder-${selectedTeams.length}`,
      name: `TBD Team ${selectedTeams.length + 1}`,
      tournament_id: tournamentId,
      color_hex: '#1E293B'
    });
  }

  const roundName = size === 16 ? 'Round of 16' : size === 8 ? 'Quarterfinals' : size === 4 ? 'Semifinals' : 'Finals';
  const fixtures: Omit<Match, 'id' | 'status'>[] = [];

  for (let i = 0; i < size / 2; i++) {
    const scheduledTime = new Date();
    scheduledTime.setHours(18 + i, 0, 0, 0); // Space out matches by an hour

    fixtures.push({
      tournament_id: tournamentId,
      round_name: roundName,
      team_a_id: selectedTeams[i].id,
      team_b_id: selectedTeams[size - 1 - i].id, // 1 vs 8, 2 vs 7 style seeding
      scheduled_at: scheduledTime.toISOString(),
      metadata_jsonb: {
        match_index: i,
        next_match_index: Math.floor(i / 2) // determines which match winner goes to
      }
    });
  }

  return fixtures;
}

/**
 * Check if the active knockout round is completed, and if so, auto-generates the next round.
 * Returns true if new matches were generated.
 */
export async function checkAndGenerateNextKnockoutRound(
  tournamentId: string
): Promise<boolean> {
  const matches = await db.getMatches(tournamentId);
  if (matches.length === 0) return false;

  // Group matches by round name
  const roundGroups: Record<string, Match[]> = {};
  matches.forEach(m => {
    if (!roundGroups[m.round_name]) roundGroups[m.round_name] = [];
    roundGroups[m.round_name].push(m);
  });

  // Determine current round by looking at the last one created
  // Knockout rounds: 'Round of 16' -> 'Quarterfinals' -> 'Semifinals' -> 'Finals'
  const knockoutOrder = ['Round of 16', 'Quarterfinals', 'Semifinals', 'Finals'];
  let currentRoundName = '';
  for (let i = 0; i < knockoutOrder.length; i++) {
    if (roundGroups[knockoutOrder[i]]) {
      currentRoundName = knockoutOrder[i];
    }
  }

  if (!currentRoundName) return false; // Not a knockout or empty

  const currentRoundMatches = roundGroups[currentRoundName];
  const allCompleted = currentRoundMatches.every(m => m.status === 'completed');
  if (!allCompleted) return false; // Prior round matches still playing

  // Determine what the next round should be
  const currentIdx = knockoutOrder.indexOf(currentRoundName);
  if (currentIdx === knockoutOrder.length - 1) {
    // Finals completed, tournament is over!
    await db.updateTournamentStatus(tournamentId, 'completed');
    return false;
  }

  const nextRoundName = knockoutOrder[currentIdx + 1];
  
  // If next round is already generated, do nothing
  if (roundGroups[nextRoundName] && roundGroups[nextRoundName].length > 0) {
    return false;
  }

  // Generate next round pairings
  // The winner of each match goes to the next stage.
  // We sort current round matches by their match_index metadata
  const sortedCurrentMatches = [...currentRoundMatches].sort((a, b) => {
    return (a.metadata_jsonb?.match_index || 0) - (b.metadata_jsonb?.match_index || 0);
  });

  const nextRoundMatchesCount = sortedCurrentMatches.length / 2;
  const newMatchesList: Omit<Match, 'id' | 'status'>[] = [];

  for (let i = 0; i < nextRoundMatchesCount; i++) {
    const match1 = sortedCurrentMatches[i * 2];
    const match2 = sortedCurrentMatches[i * 2 + 1];

    const shootoutWinner1 = (match1 as any).metadata_jsonb?.shootout?.winner;
    const winner1 = shootoutWinner1 || (match1.team_a_score! > match1.team_b_score! ? match1.team_a_id : match1.team_b_id);
    
    const shootoutWinner2 = (match2 as any).metadata_jsonb?.shootout?.winner;
    const winner2 = shootoutWinner2 || (match2.team_a_score! > match2.team_b_score! ? match2.team_a_id : match2.team_b_id);

    const scheduledTime = new Date();
    scheduledTime.setDate(scheduledTime.getDate() + 2); // 2 days later
    scheduledTime.setHours(18 + i, 0, 0, 0);

    newMatchesList.push({
      tournament_id: tournamentId,
      round_name: nextRoundName,
      team_a_id: winner1,
      team_b_id: winner2,
      scheduled_at: scheduledTime.toISOString(),
      metadata_jsonb: {
        match_index: i,
        next_match_index: Math.floor(i / 2)
      }
    });
  }

  if (newMatchesList.length > 0) {
    await db.createMatches(newMatchesList);
    return true;
  }

  return false;
}

/**
 * Generate Round of 16 Group Stage Fixtures (4 Groups: Group A, B, C, D)
 * ONLY generates fixtures for groups that have assigned teams (minimum 2 teams per group).
 */
export function generateRoundOf16GroupFixtures(
  tournamentId: string,
  teams: Team[]
): Omit<Match, 'id' | 'status'>[] {
  const groupNames = ['Group A', 'Group B', 'Group C', 'Group D'];
  const groups: Record<string, Team[]> = {
    'Group A': [],
    'Group B': [],
    'Group C': [],
    'Group D': [],
  };

  // Group ONLY by explicitly assigned group_name
  teams.forEach((t) => {
    if (t.group_name && groups[t.group_name]) {
      groups[t.group_name].push(t);
    }
  });

  const fixtures: Omit<Match, 'id' | 'status'>[] = [];

  groupNames.forEach((groupName) => {
    const groupTeams = groups[groupName] || [];
    // Only generate round robin matches if there are at least 2 assigned teams in this group
    if (groupTeams.length >= 2) {
      const groupMatches = generateRoundRobinFixtures(tournamentId, groupTeams, false);
      const mapped = groupMatches.map((m) => ({
        ...m,
        round_name: `${groupName} - ${m.round_name}`,
        metadata_jsonb: {
          ...(m.metadata_jsonb || {}),
          group_name: groupName,
          stage: 'group_stage',
        },
      }));
      fixtures.push(...mapped);
    }
  });

  return fixtures;
}

/**
 * Generate FIFA Knockout Bracket from Group Stage standings (Top 2 per group)
 * Match 1: 1A vs 2B
 * Match 2: 1C vs 2D
 * Match 3: 1B vs 2A
 * Match 4: 1D vs 2C
 */
export function generateFIFAKnockoutBracketFixtures(
  tournamentId: string,
  groupWinners: Record<string, { winner: Team; runnerUp: Team }>
): Omit<Match, 'id' | 'status'>[] {
  const gA = groupWinners['Group A'];
  const gB = groupWinners['Group B'];
  const gC = groupWinners['Group C'];
  const gD = groupWinners['Group D'];

  if (!gA || !gB || !gC || !gD) {
    throw new Error('All 4 Groups (Group A, B, C, D) must have completed standings to generate the FIFA Knockout Bracket.');
  }

  const pairings = [
    { teamA: gA.winner, teamB: gB.runnerUp, name: 'QF 1 (1A vs 2B)', matchIndex: 0 },
    { teamA: gC.winner, teamB: gD.runnerUp, name: 'QF 2 (1C vs 2D)', matchIndex: 1 },
    { teamA: gB.winner, teamB: gA.runnerUp, name: 'QF 3 (1B vs 2A)', matchIndex: 2 },
    { teamA: gD.winner, teamB: gC.runnerUp, name: 'QF 4 (1D vs 2C)', matchIndex: 3 },
  ];

  const fixtures: Omit<Match, 'id' | 'status'>[] = [];

  pairings.forEach((p, i) => {
    const scheduledTime = new Date();
    scheduledTime.setHours(18 + i, 0, 0, 0);

    fixtures.push({
      tournament_id: tournamentId,
      round_name: 'Quarterfinals',
      team_a_id: p.teamA.id,
      team_b_id: p.teamB.id,
      scheduled_at: scheduledTime.toISOString(),
      metadata_jsonb: {
        match_index: p.matchIndex,
        next_match_index: Math.floor(p.matchIndex / 2),
        pairing_label: p.name,
        stage: 'knockout',
      },
    });
  });

  return fixtures;
}

