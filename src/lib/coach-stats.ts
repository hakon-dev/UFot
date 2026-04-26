import type { Match, CoachAggregate } from "./db";
import { getCoach, getCoaches, upsertCoach, getMatchesByCoachId } from "./db";
import { countryNameToCode } from "./country-codes";
import { fetchCoachProfile } from "./football-api";
import { minutesOf } from "./stats-aggregation";

// Cache + lazy-fetch nationalities for coach aggregates. Mirrors enrichPlayerStatsWithNationality
// but for coaches. Bounded so the 100/day API budget can't get exhausted by a single page load.
export async function enrichCoachAggregatesWithNationality(
  aggregates: CoachAggregate[],
  options: { maxFetches?: number } = {}
): Promise<void> {
  const maxFetches = options.maxFetches ?? 15;
  const ids = aggregates.map((a) => a.coachId);
  const cache = getCoaches(ids);

  for (const a of aggregates) {
    const rec = cache.get(a.coachId);
    if (rec?.photo) a.photo = rec.photo;
  }

  const toFetch = aggregates
    .filter((a) => {
      const rec = cache.get(a.coachId);
      // Refetch when we have no cache row at all, or when the cached row is missing nationality
      // (the lineup-derived path only writes id+name+photo). photo absence isn't enough — many
      // /fixtures/lineups responses have null coach photos but a /coachs?id=X profile fills it in.
      return !rec || rec.nationality == null;
    })
    .slice(0, maxFetches);

  await Promise.all(
    toFetch.map(async (a) => {
      try {
        const profile = await fetchCoachProfile(a.coachId);
        if (!profile) return;
        const code = countryNameToCode(profile.nationality);
        upsertCoach({
          id: profile.id,
          name: profile.name,
          photo: profile.photo,
          nationality: profile.nationality,
          countryCode: code,
        });
        if (profile.photo) a.photo = profile.photo;
      } catch {
        // best-effort
      }
    })
  );
}

export interface CoachMatchAppearance {
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
  side: "home" | "away";
  teamId: number | null;
  minutesWatched: number;
  watchedInPerson: boolean;
}

export interface CoachProfile {
  coachId: number;
  name: string;
  photo: string | null;
  nationality: string | null;
  countryCode: string | null;
  totalMatches: number;
  totalMinutes: number;
  wins: number;
  draws: number;
  losses: number;
  appearances: CoachMatchAppearance[];
}

export async function getCoachProfile(coachId: number): Promise<CoachProfile | null> {
  const matches = getMatchesByCoachId(coachId);
  let cache = getCoach(coachId) ?? null;

  if (!cache) {
    try {
      const profile = await fetchCoachProfile(coachId);
      if (profile) {
        const code = countryNameToCode(profile.nationality);
        upsertCoach({
          id: profile.id,
          name: profile.name,
          photo: profile.photo,
          nationality: profile.nationality,
          countryCode: code,
        });
        cache = getCoach(coachId) ?? null;
      }
    } catch {
      // best-effort
    }
  }

  if (matches.length === 0 && !cache) return null;

  const appearances: CoachMatchAppearance[] = [];
  let wins = 0;
  let draws = 0;
  let losses = 0;
  let totalMinutes = 0;
  let derivedName: string | null = null;

  for (const m of matches) {
    const side: "home" | "away" =
      m.home_coach_id === coachId ? "home" : "away";
    const minutes = minutesOf(m.watch_intervals);
    totalMinutes += minutes;

    if (m.home_score === m.away_score) draws += 1;
    else if ((side === "home" && m.home_score > m.away_score) ||
             (side === "away" && m.away_score > m.home_score)) wins += 1;
    else losses += 1;

    const sideName = side === "home" ? m.home_coach_name : m.away_coach_name;
    if (sideName && (!derivedName || sideName.length > derivedName.length)) {
      derivedName = sideName;
    }

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
      side,
      teamId: side === "home" ? m.home_team_id : m.away_team_id,
      minutesWatched: minutes,
      watchedInPerson: m.watched_in_person === 1,
    });
  }

  appearances.sort((a, b) => (a.date < b.date ? 1 : -1));

  const name = cache?.name ?? derivedName ?? `Coach ${coachId}`;

  return {
    coachId,
    name,
    photo: cache?.photo ?? null,
    nationality: cache?.nationality ?? null,
    countryCode: cache?.country_code ?? null,
    totalMatches: appearances.length,
    totalMinutes,
    wins,
    draws,
    losses,
    appearances,
  };
}

export interface RefereeProfile {
  name: string;
  totalMatches: number;
  totalMinutes: number;
  appearances: Array<{
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
    minutesWatched: number;
    watchedInPerson: boolean;
  }>;
}

export function buildRefereeProfile(name: string, matches: Match[]): RefereeProfile | null {
  if (matches.length === 0) return null;

  let totalMinutes = 0;
  const appearances = matches.map((m) => {
    const minutes = minutesOf(m.watch_intervals);
    totalMinutes += minutes;
    return {
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
      minutesWatched: minutes,
      watchedInPerson: m.watched_in_person === 1,
    };
  });
  appearances.sort((a, b) => (a.date < b.date ? 1 : -1));

  return {
    name,
    totalMatches: matches.length,
    totalMinutes,
    appearances,
  };
}
