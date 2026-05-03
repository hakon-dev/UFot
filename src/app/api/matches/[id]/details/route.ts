import {
  getMatch, getMatchDetails, getTeams, upsertTeam,
  fetchedPlayerTransferIds, getPlayerTransfers, replacePlayerTransfers,
  type MatchLineup, type TeamRecord,
} from "@/lib/db";
import { fetchTeamProfile, fetchPlayerTransfers } from "@/lib/football-api";
import { hydrateMatchDetails } from "@/lib/match-hydration";
import { getPlayerNationalities } from "@/lib/player-stats";
import { countryNameToCode } from "@/lib/country-codes";
import { NextRequest, NextResponse } from "next/server";

async function withNationalities(lineups: MatchLineup[]) {
  const ids = lineups.map((l) => l.player_id).filter((id): id is number => id != null);
  const nationalities = await getPlayerNationalities(ids);
  return Object.fromEntries(
    [...nationalities.entries()].map(([id, n]) => [id, n])
  );
}

// Ensure we know whether each of the two teams is a national team; fetch once if unknown
// and cache so future views are free.
async function resolveTeams(
  ids: Array<number | null>
): Promise<Map<number, TeamRecord>> {
  const wanted = ids.filter((id): id is number => id != null);
  const cache = getTeams(wanted);

  const missing = wanted.filter((id) => !cache.has(id));
  await Promise.all(
    missing.map(async (id) => {
      try {
        const profile = await fetchTeamProfile(id);
        if (!profile) return;
        upsertTeam({
          id: profile.id,
          name: profile.name,
          country: profile.country,
          countryCode: countryNameToCode(profile.country),
          logo: profile.logo,
          national: profile.national,
        });
      } catch {
        // best-effort
      }
    })
  );
  // Re-read so callers see whatever we just upserted.
  return getTeams(wanted);
}

function isNational(map: Map<number, TeamRecord>, id: number | null): boolean {
  if (id == null) return false;
  return map.get(id)?.national === 1;
}

// For every starter on a national-team side, fetch their transfer history (once, bounded).
// Then derive their most-recent non-national club from the transfers cache.
async function buildPlayerClubs(
  lineups: MatchLineup[],
  homeIsNational: boolean,
  awayIsNational: boolean,
  teamCache: Map<number, TeamRecord>
): Promise<Record<number, { name: string | null; logo: string | null; teamId: number | null }>> {
  const targetPlayerIds = lineups
    .filter((l) => {
      if (l.is_starter !== 1) return false;
      if (l.player_id == null) return false;
      return l.team === "home" ? homeIsNational : awayIsNational;
    })
    .map((l) => l.player_id as number);

  if (targetPlayerIds.length === 0) return {};

  const alreadyFetched = fetchedPlayerTransferIds(targetPlayerIds);
  const toFetch = targetPlayerIds.filter((id) => !alreadyFetched.has(id)).slice(0, 25);

  await Promise.all(
    toFetch.map(async (id) => {
      try {
        const transfers = await fetchPlayerTransfers(id);
        replacePlayerTransfers(
          id,
          transfers.map((t) => ({
            transferDate: t.date,
            type: t.type,
            teamInId: t.teamIn.id,
            teamInName: t.teamIn.name,
            teamInLogo: t.teamIn.logo,
            teamOutId: t.teamOut.id,
            teamOutName: t.teamOut.name,
            teamOutLogo: t.teamOut.logo,
          }))
        );
      } catch {
        // best-effort — leave the row uncached; we'll retry on next view.
      }
    })
  );

  // Cross-reference transfer team ids against the teams cache for national status. Any unknown
  // team defaults to "club" (national teams rarely appear as transfer destinations, and showing
  // a logo is better than discarding the data).
  const unknownTeamIds = new Set<number>();
  const out: Record<number, { name: string | null; logo: string | null; teamId: number | null }> = {};
  for (const pid of targetPlayerIds) {
    const rows = getPlayerTransfers(pid);
    for (const r of rows) {
      if (r.team_in_id != null && !teamCache.has(r.team_in_id)) unknownTeamIds.add(r.team_in_id);
    }
  }
  if (unknownTeamIds.size > 0) {
    const extra = await resolveTeams([...unknownTeamIds]);
    for (const [k, v] of extra) teamCache.set(k, v);
  }

  for (const pid of targetPlayerIds) {
    const rows = getPlayerTransfers(pid);
    // Transfers already sorted DESC by date in getPlayerTransfers.
    const club = rows.find((r) => {
      if (!r.team_in_id || !r.team_in_name) return false;
      const cached = teamCache.get(r.team_in_id);
      // Unknown → treat as club; known-national → skip.
      if (cached?.national === 1) return false;
      return true;
    });
    if (club) {
      out[pid] = {
        name: club.team_in_name,
        logo: club.team_in_logo,
        teamId: club.team_in_id,
      };
    }
  }

  return out;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const match = getMatch(id);
  if (!match) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  async function buildPayload(
    lineups: MatchLineup[],
    homeTeamId: number | null,
    awayTeamId: number | null
  ) {
    const teamCache = await resolveTeams([homeTeamId, awayTeamId]);
    const homeIsNational = isNational(teamCache, homeTeamId);
    const awayIsNational = isNational(teamCache, awayTeamId);

    const playerClubs =
      homeIsNational || awayIsNational
        ? await buildPlayerClubs(lineups, homeIsNational, awayIsNational, teamCache)
        : {};

    const nationalities = await withNationalities(lineups);
    return { nationalities, playerClubs, homeIsNational, awayIsNational };
  }

  // Manual match or legacy football-data.org id that no longer resolves — no API data available.
  if (!match.details_fetched && (!match.external_match_id || match.external_source !== "api-football")) {
    return NextResponse.json({ available: false });
  }

  // Re-hydrate when never fetched OR previously fetched with incomplete data (lineups/goals
  // not yet posted at first fetch). For incomplete rows we already have something to show, so
  // a hydration failure isn't fatal — fall through and serve the partial data we have.
  const needsFetch = !match.details_fetched || !match.details_complete;
  const canFetch = match.external_match_id && match.external_source === "api-football";
  if (needsFetch && canFetch) {
    const ok = await hydrateMatchDetails(id);
    if (!ok && !match.details_fetched) {
      return NextResponse.json(
        { error: "Failed to fetch match details" },
        { status: 502 }
      );
    }
  }

  const refreshed = getMatch(id) ?? match;
  const saved = getMatchDetails(id);
  const extras = await buildPayload(
    saved.lineups,
    refreshed.home_team_id,
    refreshed.away_team_id
  );
  return NextResponse.json({
    available: true,
    homeFormation: refreshed.home_formation,
    awayFormation: refreshed.away_formation,
    homeTeamId: refreshed.home_team_id,
    awayTeamId: refreshed.away_team_id,
    ...extras,
    ...saved,
  });
}
