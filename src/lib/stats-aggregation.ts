import type { Match } from "./db";
import type { CompetitionStat } from "@/app/stats/CompetitionStatsTable";
import type { TeamStat } from "@/app/stats/TeamStatsTable";

export function minutesOf(rawIntervals: string | null): number {
  try {
    const intervals: number[][] = JSON.parse(rawIntervals || "[[0,90]]");
    return intervals.reduce((s, [a, b]) => s + (b - a), 0);
  } catch {
    return 90;
  }
}

export function aggregateCompetitions(matches: Match[]): CompetitionStat[] {
  // Key by name so legacy rows (competition_id = NULL) merge with newer rows of the same
  // competition that do carry an ID. Promote the ID whenever any match in the group has one,
  // so the enrichment step can still fetch logo/country for the merged entry.
  const map = new Map<string, CompetitionStat>();
  for (const m of matches) {
    const name = m.competition || "Unknown";
    const mins = minutesOf(m.watch_intervals);
    const existing = map.get(name);
    if (existing) {
      existing.matches += 1;
      existing.minutes += mins;
      if (existing.competitionId == null && m.competition_id != null) {
        existing.competitionId = m.competition_id;
      }
    } else {
      map.set(name, {
        competitionId: m.competition_id ?? null,
        competition: name,
        logo: null,
        country: null,
        countryCode: null,
        matches: 1,
        minutes: mins,
      });
    }
  }
  return [...map.values()];
}

export function aggregateTeams(matches: Match[]): TeamStat[] {
  const map = new Map<string, TeamStat>();

  function ensure(name: string, crest: string | null, teamId: number | null): TeamStat {
    let rec = map.get(name);
    if (!rec) {
      rec = {
        team: name,
        teamId,
        crest,
        country: null,
        countryCode: null,
        matches: 0,
        minutes: 0,
        goalsFor: 0,
        goalsAgainst: 0,
      };
      map.set(name, rec);
    } else {
      if (!rec.crest && crest) rec.crest = crest;
      if (rec.teamId == null && teamId != null) rec.teamId = teamId;
    }
    return rec;
  }

  for (const m of matches) {
    const mins = minutesOf(m.watch_intervals);
    const home = ensure(m.home_team, m.home_crest, m.home_team_id);
    const away = ensure(m.away_team, m.away_crest, m.away_team_id);
    home.matches += 1;
    home.minutes += mins;
    home.goalsFor += m.home_score;
    home.goalsAgainst += m.away_score;
    away.matches += 1;
    away.minutes += mins;
    away.goalsFor += m.away_score;
    away.goalsAgainst += m.home_score;
  }

  return [...map.values()];
}
