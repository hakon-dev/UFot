import type { Match } from "./db";
import { getAllMatches, getMatchesWithDetails, getTeams, upsertTeam } from "./db";
import { countryNameToCode } from "./country-codes";
import { computePlayerStats, type PlayerStat } from "./player-stats";
import { fetchTeamProfile } from "./football-api";

export interface TeamMatchAppearance {
  matchId: string;
  date: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamId: number | null;
  awayTeamId: number | null;
  homeScore: number;
  awayScore: number;
  homeCrest: string | null;
  awayCrest: string | null;
  competition: string | null;
  competitionId: number | null;
  isHome: boolean;
  minutesWatched: number;
  watchedInPerson: boolean;
}

export interface TeamProfile {
  teamId: number;
  name: string;
  crestUrl: string;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  totalMinutes: number;
  totalMatches: number;
  appearances: TeamMatchAppearance[];
}

function parseIntervals(raw: string | null): number[][] {
  try {
    return JSON.parse(raw || "[[0,90]]");
  } catch {
    return [[0, 90]];
  }
}

function minutesFor(match: Match): number {
  return parseIntervals(match.watch_intervals).reduce((s, [a, b]) => s + (b - a), 0);
}

export function getTeamProfile(teamId: number): TeamProfile | null {
  const matches = getAllMatches();
  const mine = matches.filter((m) => m.home_team_id === teamId || m.away_team_id === teamId);
  if (mine.length === 0) return null;

  let name: string | null = null;
  let crestUrl = `https://media.api-sports.io/football/teams/${teamId}.png`;
  let wins = 0, draws = 0, losses = 0, gf = 0, ga = 0, mins = 0;
  const appearances: TeamMatchAppearance[] = [];

  for (const m of mine) {
    const isHome = m.home_team_id === teamId;
    const myGoals = isHome ? m.home_score : m.away_score;
    const theirGoals = isHome ? m.away_score : m.home_score;
    if (myGoals > theirGoals) wins += 1;
    else if (myGoals < theirGoals) losses += 1;
    else draws += 1;
    gf += myGoals;
    ga += theirGoals;

    const minutesWatched = minutesFor(m);
    mins += minutesWatched;
    if (!name) name = isHome ? m.home_team : m.away_team;
    if (isHome && m.home_crest) crestUrl = m.home_crest;
    if (!isHome && m.away_crest) crestUrl = m.away_crest;

    appearances.push({
      matchId: m.id,
      date: m.date,
      homeTeam: m.home_team,
      awayTeam: m.away_team,
      homeTeamId: m.home_team_id,
      awayTeamId: m.away_team_id,
      homeScore: m.home_score,
      awayScore: m.away_score,
      homeCrest: m.home_crest,
      awayCrest: m.away_crest,
      competition: m.competition,
      competitionId: m.competition_id,
      isHome,
      minutesWatched,
      watchedInPerson: m.watched_in_person === 1,
    });
  }

  appearances.sort((a, b) => (a.date < b.date ? 1 : -1));

  return {
    teamId,
    name: name ?? `Team ${teamId}`,
    crestUrl,
    wins,
    draws,
    losses,
    goalsFor: gf,
    goalsAgainst: ga,
    totalMinutes: mins,
    totalMatches: mine.length,
    appearances,
  };
}

export interface TeamCountryRecord {
  teamId: number | null;
  country: string | null;
  countryCode: string | null;
  national?: boolean | null;
}

export async function enrichTeamRecordsWithCountry<T extends TeamCountryRecord>(
  records: T[],
  options: { maxFetches?: number } = {}
): Promise<void> {
  const maxFetches = options.maxFetches ?? 20;

  const ids = records.map((r) => r.teamId).filter((id): id is number => id != null);
  const cached = getTeams(ids);

  for (const r of records) {
    if (r.teamId == null) continue;
    const rec = cached.get(r.teamId);
    if (rec) {
      r.country = rec.country;
      r.countryCode = rec.country_code;
      r.national = rec.national == null ? null : rec.national === 1;
    }
  }

  // Re-fetch rows where `national` is still NULL — they came from a cache populated before
  // the `national` column existed, and would otherwise stay mis-classified forever.
  const toFetch = records
    .filter((r) => {
      if (r.teamId == null) return false;
      const rec = cached.get(r.teamId);
      return !rec || rec.national == null;
    })
    .slice(0, maxFetches);

  await Promise.all(
    toFetch.map(async (r) => {
      if (r.teamId == null) return;
      try {
        const profile = await fetchTeamProfile(r.teamId);
        if (!profile) return;
        const code = countryNameToCode(profile.country);
        upsertTeam({
          id: profile.id,
          name: profile.name,
          country: profile.country,
          countryCode: code,
          logo: profile.logo,
          national: profile.national,
        });
        r.country = profile.country;
        r.countryCode = code;
        r.national = profile.national;
      } catch {
        // Best-effort; country column falls back to "-" if the fetch fails.
      }
    })
  );
}

export function getTeamPlayers(teamId: number): PlayerStat[] {
  const matches = getMatchesWithDetails();
  const mine = matches.filter(
    (m) => m.home_team_id === teamId || m.away_team_id === teamId
  );
  return computePlayerStats(mine, { onlyTeamId: teamId });
}
