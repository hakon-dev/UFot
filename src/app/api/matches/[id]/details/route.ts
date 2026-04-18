import { getMatch, getMatchDetails, saveMatchDetails } from "@/lib/db";
import { fetchMatchDetails } from "@/lib/football-api";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const match = getMatch(id);
  if (!match) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  // Already cached
  if (match.details_fetched) {
    const details = getMatchDetails(id);
    return NextResponse.json({
      available: true,
      homeFormation: match.home_formation,
      awayFormation: match.away_formation,
      homeTeamId: match.home_team_id,
      awayTeamId: match.away_team_id,
      ...details,
    });
  }

  // Manual match or legacy football-data.org id that no longer resolves — no API data available.
  if (!match.external_match_id || match.external_source !== "api-football") {
    return NextResponse.json({ available: false });
  }

  try {
    const details = await fetchMatchDetails(match.external_match_id);

    saveMatchDetails(
      id,
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
      {
        homeFormation: details.homeFormation,
        awayFormation: details.awayFormation,
        homeTeamId: details.homeTeamId,
        awayTeamId: details.awayTeamId,
      }
    );

    const saved = getMatchDetails(id);
    const refreshed = getMatch(id);
    return NextResponse.json({
      available: true,
      homeFormation: refreshed?.home_formation ?? null,
      awayFormation: refreshed?.away_formation ?? null,
      homeTeamId: refreshed?.home_team_id ?? null,
      awayTeamId: refreshed?.away_team_id ?? null,
      ...saved,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch match details" },
      { status: 502 }
    );
  }
}
