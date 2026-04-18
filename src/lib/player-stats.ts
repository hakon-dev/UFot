import type { Match, MatchGoal, MatchSubstitution, MatchLineup, MatchCard } from "./db";
import { getMatchesWithDetails, getPlayers, upsertPlayer } from "./db";
import { countryNameToCode } from "./country-codes";
import { fetchPlayerProfile } from "./football-api";

export interface PlayerStat {
  playerId: number | null;
  name: string;
  minutesWatched: number;
  matches: number;
  goalsWatched: number;
  assistsWatched: number;
  yellowsWatched: number;
  redsWatched: number;
  club: string | null;
  clubId: number | null;
  clubCrest: string | null;
  nationality: string | null;
  countryCode: string | null;
}

type MatchWithDetails = Match & {
  goals: MatchGoal[];
  substitutions: MatchSubstitution[];
  lineups: MatchLineup[];
  cards: MatchCard[];
};

function parseIntervals(raw: string | null): number[][] {
  try {
    return JSON.parse(raw || "[[0,90]]");
  } catch {
    return [[0, 90]];
  }
}

function intervalOverlap(playerStart: number, playerEnd: number, watchIntervals: number[][]): number {
  let total = 0;
  for (const [ws, we] of watchIntervals) {
    total += Math.max(0, Math.min(playerEnd, we) - Math.max(playerStart, ws));
  }
  return total;
}

function minuteInIntervals(minute: number, intervals: number[][]): boolean {
  return intervals.some(([s, e]) => minute >= s && minute <= e);
}

function playerKey(playerId: number | null, name: string): string {
  return playerId != null ? `id:${playerId}` : `name:${name}`;
}

function buildSubMap(
  subs: MatchSubstitution[],
  side: "in" | "out"
): Map<string, number> {
  const map = new Map<string, number>();
  for (const sub of subs) {
    const id = side === "in" ? sub.player_in_id : sub.player_out_id;
    const name = side === "in" ? sub.player_in : sub.player_out;
    if (id != null) map.set(`id:${id}`, sub.minute);
    if (name) map.set(`name:${name}`, sub.minute);
  }
  return map;
}

function lookupSubMinute(
  map: Map<string, number>,
  playerId: number | null,
  name: string
): number | undefined {
  if (playerId != null) {
    const byId = map.get(`id:${playerId}`);
    if (byId !== undefined) return byId;
  }
  return map.get(`name:${name}`);
}

export interface ComputeOptions {
  onlyTeamId?: number;
}

export function computePlayerStats(
  matches: MatchWithDetails[],
  options: ComputeOptions = {}
): PlayerStat[] {
  const stats = new Map<string, PlayerStat>();
  const latestClubDate = new Map<string, string>();
  const { onlyTeamId } = options;

  function ensure(playerId: number | null, name: string): PlayerStat {
    const key = playerKey(playerId, name);
    let s = stats.get(key);
    if (!s) {
      s = {
        playerId, name, minutesWatched: 0, matches: 0, goalsWatched: 0, assistsWatched: 0,
        yellowsWatched: 0, redsWatched: 0,
        club: null, clubId: null, clubCrest: null, nationality: null, countryCode: null,
      };
      stats.set(key, s);
    } else if (s.playerId == null && playerId != null) {
      // Upgrade a name-only entry once we see the ID.
      s.playerId = playerId;
    }
    return s;
  }

  function recordClub(
    playerId: number | null,
    name: string,
    matchDate: string,
    club: string,
    clubId: number | null,
    clubCrest: string | null
  ): void {
    const key = playerKey(playerId, name);
    const prev = latestClubDate.get(key);
    if (prev && prev >= matchDate) return;
    latestClubDate.set(key, matchDate);
    const s = stats.get(key);
    if (s) {
      s.club = club;
      s.clubId = clubId;
      s.clubCrest = clubCrest;
    }
  }

  for (const match of matches) {
    // Skip matches that don't involve the filtered team.
    let teamSide: "home" | "away" | null = null;
    if (onlyTeamId != null) {
      if (match.home_team_id === onlyTeamId) teamSide = "home";
      else if (match.away_team_id === onlyTeamId) teamSide = "away";
      else continue;
    }
    const teamSideName =
      teamSide === "home" ? match.home_team : teamSide === "away" ? match.away_team : null;

    const watchIntervals = parseIntervals(match.watch_intervals);

    const subbedOut = buildSubMap(match.substitutions, "out");
    const subbedIn = buildSubMap(match.substitutions, "in");

    // Look up player_id for goal/assist name matching inside this match
    // (fallback when the goal event itself doesn't carry scorer_id/assist_id).
    const nameToId = new Map<string, number>();
    for (const l of match.lineups) {
      if (l.player_id != null) nameToId.set(l.player_name, l.player_id);
    }

    for (const lineup of match.lineups) {
      if (teamSide && lineup.team !== teamSide) continue;

      let playerStart: number;
      let playerEnd: number;

      if (lineup.is_starter === 1) {
        playerStart = 0;
        playerEnd = lookupSubMinute(subbedOut, lineup.player_id, lineup.player_name) ?? 90;
      } else {
        const subInMinute = lookupSubMinute(subbedIn, lineup.player_id, lineup.player_name);
        if (subInMinute === undefined) continue;
        playerStart = subInMinute;
        playerEnd = lookupSubMinute(subbedOut, lineup.player_id, lineup.player_name) ?? 90;
      }

      const overlap = intervalOverlap(playerStart, playerEnd, watchIntervals);
      if (overlap > 0) {
        const stat = ensure(lineup.player_id, lineup.player_name);
        stat.minutesWatched += overlap;
        stat.matches += 1;

        const isHome = lineup.team === "home";
        recordClub(
          lineup.player_id,
          lineup.player_name,
          match.date,
          isHome ? match.home_team : match.away_team,
          isHome ? match.home_team_id : match.away_team_id,
          isHome ? match.home_crest : match.away_crest
        );
      }
    }

    for (const goal of match.goals) {
      if (teamSideName && goal.team !== teamSideName) continue;
      if (!minuteInIntervals(goal.minute, watchIntervals)) continue;

      if (goal.type !== "OWN_GOAL") {
        const scorerId = goal.scorer_id ?? nameToId.get(goal.scorer_name) ?? null;
        ensure(scorerId, goal.scorer_name).goalsWatched += 1;
      }
      if (goal.assist_name) {
        const assistId = goal.assist_id ?? nameToId.get(goal.assist_name) ?? null;
        ensure(assistId, goal.assist_name).assistsWatched += 1;
      }
    }

    for (const card of match.cards) {
      if (teamSideName && card.team !== teamSideName) continue;
      if (!minuteInIntervals(card.minute, watchIntervals)) continue;

      const pid = card.player_id ?? nameToId.get(card.player_name) ?? null;
      const stat = ensure(pid, card.player_name);
      if (card.card_type === "YELLOW") stat.yellowsWatched += 1;
      else if (card.card_type === "RED" || card.card_type === "YELLOWRED") stat.redsWatched += 1;
    }
  }

  return [...stats.values()].sort((a, b) => b.minutesWatched - a.minutesWatched);
}

export interface PlayerNationality {
  nationality: string | null;
  countryCode: string | null;
}

export async function getPlayerNationalities(
  playerIds: number[],
  options: { maxFetches?: number } = {}
): Promise<Map<number, PlayerNationality>> {
  const maxFetches = options.maxFetches ?? 15;
  const result = new Map<number, PlayerNationality>();
  const uniqueIds = [...new Set(playerIds)];
  const cached = getPlayers(uniqueIds);

  for (const id of uniqueIds) {
    const rec = cached.get(id);
    if (rec) {
      result.set(id, { nationality: rec.nationality, countryCode: rec.country_code });
    }
  }

  const toFetch = uniqueIds.filter((id) => !cached.has(id)).slice(0, maxFetches);
  await Promise.all(
    toFetch.map(async (id) => {
      try {
        const profile = await fetchPlayerProfile(id);
        if (!profile) return;
        const code = countryNameToCode(profile.nationality);
        upsertPlayer({
          id: profile.id,
          name: profile.name,
          nationality: profile.nationality,
          countryCode: code,
          photo: profile.photo,
        });
        result.set(id, { nationality: profile.nationality, countryCode: code });
      } catch {
        // best-effort
      }
    })
  );

  return result;
}

export async function enrichPlayerStatsWithNationality(
  stats: PlayerStat[],
  options: { maxFetches?: number } = {}
): Promise<void> {
  const maxFetches = options.maxFetches ?? 20;

  const ids = stats.map((s) => s.playerId).filter((id): id is number => id != null);
  const cached = getPlayers(ids);

  // Fill from cache.
  for (const s of stats) {
    if (s.playerId == null) continue;
    const rec = cached.get(s.playerId);
    if (rec) {
      s.nationality = rec.nationality;
      s.countryCode = rec.country_code;
    }
  }

  // Fetch missing ones, bounded by maxFetches to respect the 100/day API budget.
  const toFetch = stats
    .filter((s) => s.playerId != null && !cached.has(s.playerId))
    .slice(0, maxFetches);

  await Promise.all(
    toFetch.map(async (s) => {
      if (s.playerId == null) return;
      try {
        const profile = await fetchPlayerProfile(s.playerId);
        if (!profile) return;
        const code = countryNameToCode(profile.nationality);
        upsertPlayer({
          id: profile.id,
          name: profile.name,
          nationality: profile.nationality,
          countryCode: code,
          photo: profile.photo,
        });
        s.nationality = profile.nationality;
        s.countryCode = code;
      } catch {
        // Swallow — nationality is best-effort; table still renders without it.
      }
    })
  );
}

export interface PlayerMatchAppearance {
  matchId: string;
  date: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  homeCrest: string | null;
  awayCrest: string | null;
  team: "home" | "away";
  minutesWatched: number;
  goalsWatched: number;
  assistsWatched: number;
  yellowsWatched: number;
  redsWatched: number;
}

export interface PlayerProfile {
  playerId: number;
  name: string;
  photoUrl: string;
  totalMinutes: number;
  totalMatches: number;
  totalGoals: number;
  totalAssists: number;
  totalYellows: number;
  totalReds: number;
  appearances: PlayerMatchAppearance[];
}

export function getPlayerProfile(playerId: number): PlayerProfile | null {
  const matches = getMatchesWithDetails();
  let latestName: string | null = null;
  let latestDate = "";
  const appearances: PlayerMatchAppearance[] = [];

  for (const match of matches) {
    const watchIntervals = parseIntervals(match.watch_intervals);
    const lineup = match.lineups.find((l) => l.player_id === playerId);
    if (!lineup) continue;

    if (!latestName || match.date > latestDate) {
      latestName = lineup.player_name;
      latestDate = match.date;
    }

    const subbedOut = buildSubMap(match.substitutions, "out");
    const subbedIn = buildSubMap(match.substitutions, "in");

    let playerStart: number;
    let playerEnd: number;
    if (lineup.is_starter === 1) {
      playerStart = 0;
      playerEnd = lookupSubMinute(subbedOut, lineup.player_id, lineup.player_name) ?? 90;
    } else {
      const subInMinute = lookupSubMinute(subbedIn, lineup.player_id, lineup.player_name);
      if (subInMinute === undefined) continue;
      playerStart = subInMinute;
      playerEnd = lookupSubMinute(subbedOut, lineup.player_id, lineup.player_name) ?? 90;
    }

    const minutesWatched = intervalOverlap(playerStart, playerEnd, watchIntervals);
    if (minutesWatched <= 0) continue;

    let goalsWatched = 0;
    let assistsWatched = 0;
    for (const goal of match.goals) {
      if (!minuteInIntervals(goal.minute, watchIntervals)) continue;
      if ((goal.scorer_id === playerId || goal.scorer_name === lineup.player_name) && goal.type !== "OWN_GOAL") goalsWatched += 1;
      if (goal.assist_id === playerId || goal.assist_name === lineup.player_name) assistsWatched += 1;
    }

    let yellowsWatched = 0;
    let redsWatched = 0;
    for (const card of match.cards) {
      if (!minuteInIntervals(card.minute, watchIntervals)) continue;
      if (card.player_id !== playerId && card.player_name !== lineup.player_name) continue;
      if (card.card_type === "YELLOW") yellowsWatched += 1;
      else if (card.card_type === "RED" || card.card_type === "YELLOWRED") redsWatched += 1;
    }

    appearances.push({
      matchId: match.id,
      date: match.date,
      homeTeam: match.home_team,
      awayTeam: match.away_team,
      homeScore: match.home_score,
      awayScore: match.away_score,
      homeCrest: match.home_crest,
      awayCrest: match.away_crest,
      team: lineup.team as "home" | "away",
      minutesWatched,
      goalsWatched,
      assistsWatched,
      yellowsWatched,
      redsWatched,
    });
  }

  if (!latestName || appearances.length === 0) return null;

  appearances.sort((a, b) => (a.date < b.date ? 1 : -1));

  return {
    playerId,
    name: latestName,
    photoUrl: `https://media.api-sports.io/football/players/${playerId}.png`,
    totalMinutes: appearances.reduce((s, a) => s + a.minutesWatched, 0),
    totalMatches: appearances.length,
    totalGoals: appearances.reduce((s, a) => s + a.goalsWatched, 0),
    totalAssists: appearances.reduce((s, a) => s + a.assistsWatched, 0),
    totalYellows: appearances.reduce((s, a) => s + a.yellowsWatched, 0),
    totalReds: appearances.reduce((s, a) => s + a.redsWatched, 0),
    appearances,
  };
}
