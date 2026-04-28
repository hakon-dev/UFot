import {
  getAllMatches, getMatchesWithDetails, getStadiumAggregates,
  getCoachAggregates, getRefereeAggregates, nationalTeamIds,
} from "./db";
import { aggregateTeams, aggregateCompetitions } from "./stats-aggregation";
import { computePlayerStats, enrichPlayerStatsWithNationality } from "./player-stats";
import { enrichTeamRecordsWithCountry } from "./team-stats";
import { enrichCompetitionRecordsWithDetails, resolveCompetitionRegion } from "./competition-stats";
import { enrichCoachAggregatesWithNationality } from "./coach-stats";
import { getCoaches } from "./db";
export type EntityKind =
  | "player"
  | "team"
  | "national_team"
  | "competition"
  | "stadium"
  | "coach"
  | "referee";

export type RankScope =
  | { kind: "country"; countryName: string; countryCode: string | null }
  | { kind: "region"; name: string }
  | { kind: "in-person" };

export interface RankItem {
  entity: EntityKind;
  rank: number;
  total: number;
  scope?: RankScope;
}

export async function getPlayerRank(playerId: number): Promise<RankItem[]> {
  const stats = computePlayerStats(getMatchesWithDetails());
  await enrichPlayerStatsWithNationality(stats);

  const idx = stats.findIndex((s) => s.playerId === playerId);
  if (idx === -1) return [];

  const items: RankItem[] = [
    { entity: "player", rank: idx + 1, total: stats.length },
  ];

  const target = stats[idx];
  if (target.countryCode && target.nationality) {
    const peers = stats.filter((s) => s.countryCode === target.countryCode);
    const peerIdx = peers.findIndex((s) => s.playerId === playerId);
    if (peerIdx !== -1 && peers.length > 1) {
      items.push({
        entity: "player",
        rank: peerIdx + 1,
        total: peers.length,
        scope: {
          kind: "country",
          countryName: target.nationality,
          countryCode: target.countryCode,
        },
      });
    }
  }

  return items;
}

export async function getTeamRank(teamId: number): Promise<RankItem[]> {
  const teams = aggregateTeams(getAllMatches());
  await enrichTeamRecordsWithCountry(teams);

  const target = teams.find((t) => t.teamId === teamId);
  if (!target) return [];

  const targetIsNational = target.national === true;

  // Overall "team" rank uses the mixed pool — same set the user sees on /stats/teams.
  const overallPool = [...teams].sort((a, b) => b.minutes - a.minutes);
  const overallIdx = overallPool.findIndex((t) => t.teamId === teamId);
  if (overallIdx === -1) return [];

  const items: RankItem[] = [
    { entity: "team", rank: overallIdx + 1, total: overallPool.length },
  ];

  if (targetIsNational) {
    // National teams also get a rank against the nationals-only pool — links to
    // /stats/national-teams. Country scope is skipped (a national team's peers in its country
    // are just its age-group and women's variants).
    const nationalsPool = overallPool.filter((t) => t.national === true);
    const natIdx = nationalsPool.findIndex((t) => t.teamId === teamId);
    if (natIdx !== -1) {
      items.push({
        entity: "national_team",
        rank: natIdx + 1,
        total: nationalsPool.length,
      });
    }
  } else if (target.countryCode && target.country) {
    // Clubs get a country-scoped rank against other clubs from the same country.
    const clubsFromCountry = overallPool.filter(
      (t) => t.countryCode === target.countryCode && t.national !== true
    );
    if (clubsFromCountry.length > 1) {
      const peerIdx = clubsFromCountry.findIndex((t) => t.teamId === teamId);
      if (peerIdx !== -1) {
        items.push({
          entity: "team",
          rank: peerIdx + 1,
          total: clubsFromCountry.length,
          scope: {
            kind: "country",
            countryName: target.country,
            countryCode: target.countryCode,
          },
        });
      }
    }
  }

  return items;
}

export async function getCompetitionRank(competitionId: number): Promise<RankItem[]> {
  const comps = aggregateCompetitions(getAllMatches());
  await enrichCompetitionRecordsWithDetails(comps);
  comps.sort((a, b) => b.minutes - a.minutes);

  const idx = comps.findIndex((c) => c.competitionId === competitionId);
  if (idx === -1) return [];

  const target = comps[idx];
  const items: RankItem[] = [
    { entity: "competition", rank: idx + 1, total: comps.length },
  ];

  // After enrichment, country/countryCode reflect the resolved region (continental competitions
  // report e.g. "Europe" with a null countryCode). Group peers by the same country/region label.
  const region = resolveCompetitionRegion(target.competitionId, target.country, target.countryCode);
  const scopeLabel = region.country;
  if (scopeLabel) {
    const peers = comps.filter((c) => {
      const r = resolveCompetitionRegion(c.competitionId, c.country, c.countryCode);
      return r.country === scopeLabel;
    });
    if (peers.length > 1) {
      const peerIdx = peers.findIndex((c) => c.competitionId === competitionId);
      if (peerIdx !== -1) {
        items.push({
          entity: "competition",
          rank: peerIdx + 1,
          total: peers.length,
          scope:
            region.countryCode != null
              ? { kind: "country", countryName: scopeLabel, countryCode: region.countryCode }
              : { kind: "region", name: scopeLabel },
        });
      }
    }
  }

  return items;
}

export function getStadiumRank(venueId: number): RankItem[] {
  const stadiums = getStadiumAggregates();
  const overall = [...stadiums].sort((a, b) => b.totalMinutes - a.totalMinutes);
  const idx = overall.findIndex((s) => s.venueId === venueId);
  if (idx === -1) return [];

  const items: RankItem[] = [
    { entity: "stadium", rank: idx + 1, total: overall.length },
  ];

  const target = overall[idx];
  if (target.inPersonMatches > 0) {
    const inPerson = stadiums
      .filter((s) => s.inPersonMatches > 0)
      .sort((a, b) => b.inPersonMinutes - a.inPersonMinutes);
    if (inPerson.length > 1) {
      const ipIdx = inPerson.findIndex((s) => s.venueId === venueId);
      if (ipIdx !== -1) {
        items.push({
          entity: "stadium",
          rank: ipIdx + 1,
          total: inPerson.length,
          scope: { kind: "in-person" },
        });
      }
    }
  }

  return items;
}

export async function getCoachRank(coachId: number): Promise<RankItem[]> {
  const coaches = getCoachAggregates();
  await enrichCoachAggregatesWithNationality(coaches);
  coaches.sort((a, b) => b.minutes - a.minutes);

  const idx = coaches.findIndex((c) => c.coachId === coachId);
  if (idx === -1) return [];

  const items: RankItem[] = [
    { entity: "coach", rank: idx + 1, total: coaches.length },
  ];

  // CoachAggregate doesn't carry nationality directly — it's in the cache. Pull it for both the
  // target and any prospective peers so we can scope by countryCode.
  const cache = getCoaches(coaches.map((c) => c.coachId));
  const targetCache = cache.get(coachId);
  if (targetCache?.country_code && targetCache.nationality) {
    const code = targetCache.country_code;
    const peers = coaches.filter((c) => cache.get(c.coachId)?.country_code === code);
    if (peers.length > 1) {
      const peerIdx = peers.findIndex((c) => c.coachId === coachId);
      if (peerIdx !== -1) {
        items.push({
          entity: "coach",
          rank: peerIdx + 1,
          total: peers.length,
          scope: {
            kind: "country",
            countryName: targetCache.nationality,
            countryCode: code,
          },
        });
      }
    }
  }

  return items;
}

export function getRefereeRank(name: string): RankItem[] {
  const refs = getRefereeAggregates().sort((a, b) => b.minutes - a.minutes);
  const idx = refs.findIndex((r) => r.name === name);
  if (idx === -1) return [];
  return [{ entity: "referee", rank: idx + 1, total: refs.length }];
}
