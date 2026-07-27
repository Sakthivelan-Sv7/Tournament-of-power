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

    const winner1 = match1.team_a_score! > match1.team_b_score! ? match1.team_a_id : match1.team_b_id;
    const winner2 = match2.team_a_score! > match2.team_b_score! ? match2.team_a_id : match2.team_b_id;

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
