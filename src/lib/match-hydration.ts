import { getMatch, getPendingHydrationIds, saveMatchDetails } from "./db";
import { fetchMatchDetails } from "./football-api";

// Pull details for one match from api-football and persist them. Safe to call repeatedly:
// returns true for already-hydrated rows, false for manual/legacy rows we can't resolve,
// and false on transient fetch failures (which leaves `details_fetched` at 0 so the next
// caller — stats-page rescue or the details route — retries).
export async function hydrateMatchDetails(matchId: string): Promise<boolean> {
  const match = getMatch(matchId);
  if (!match) return false;
  if (match.details_fetched) return true;
  if (!match.external_match_id || match.external_source !== "api-football") return false;

  try {
    const details = await fetchMatchDetails(match.external_match_id);

    saveMatchDetails(
      matchId,
      details.goals.map((g) => ({
        minute: g.minute,
        team: g.team,
        scorer_name: g.scorerName,
        assist_name: g.assistName,
        scorer_id: g.scorerId,
        assist_id: g.assistId,
        type: g.type,
      })),
      details.substitutions.map((s) => ({
        minute: s.minute,
        team: s.team,
        player_out: s.playerOut,
        player_in: s.playerIn,
        player_out_id: s.playerOutId,
        player_in_id: s.playerInId,
      })),
      [
        ...details.homeLineup.map((p) => ({
          team: "home",
          player_name: p.name,
          position: p.position,
          shirt_number: p.shirtNumber,
          is_starter: p.isStarter ? 1 : 0,
          player_id: p.playerId,
          grid_position: p.grid,
        })),
        ...details.awayLineup.map((p) => ({
          team: "away",
          player_name: p.name,
          position: p.position,
          shirt_number: p.shirtNumber,
          is_starter: p.isStarter ? 1 : 0,
          player_id: p.playerId,
          grid_position: p.grid,
        })),
      ],
      details.cards.map((c) => ({
        minute: c.minute,
        team: c.team,
        player_name: c.playerName,
        player_id: c.playerId,
        card_type: c.cardType,
      })),
      {
        homeFormation: details.homeFormation,
        awayFormation: details.awayFormation,
        homeTeamId: details.homeTeamId,
        awayTeamId: details.awayTeamId,
      }
    );
    return true;
  } catch {
    return false;
  }
}

// Backfill up to `limit` matches that were added but never had their details fetched (e.g.
// the user bailed before the detail page loaded, or the POST-time fetch hit a transient
// error). Bounded because each match = 3 api-football requests and the free tier is 100/day.
export async function hydratePendingMatches(limit: number): Promise<number> {
  const ids = getPendingHydrationIds(limit);
  if (ids.length === 0) return 0;

  let hydrated = 0;
  for (const id of ids) {
    if (await hydrateMatchDetails(id)) hydrated += 1;
  }
  return hydrated;
}
