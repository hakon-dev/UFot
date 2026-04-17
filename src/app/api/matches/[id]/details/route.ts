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
    return NextResponse.json({ available: true, ...details });
  }

  // Manual match — no API data available
  if (!match.football_data_id) {
    return NextResponse.json({ available: false });
  }

  // Fetch from football-data.org and cache
  try {
    const details = await fetchMatchDetails(match.football_data_id);

    saveMatchDetails(
      id,
      details.goals.map((g) => ({
        minute: g.minute,
        team: g.team,
        scorer_name: g.scorerName,
        assist_name: g.assistName,
        type: g.type,
      })),
      details.substitutions.map((s) => ({
        minute: s.minute,
        team: s.team,
        player_out: s.playerOut,
        player_in: s.playerIn,
      })),
      [
        ...details.homeLineup.map((p) => ({
          team: "home",
          player_name: p.name,
          position: p.position,
          shirt_number: p.shirtNumber,
          is_starter: p.isStarter ? 1 : 0,
        })),
        ...details.awayLineup.map((p) => ({
          team: "away",
          player_name: p.name,
          position: p.position,
          shirt_number: p.shirtNumber,
          is_starter: p.isStarter ? 1 : 0,
        })),
      ]
    );

    const saved = getMatchDetails(id);
    return NextResponse.json({ available: true, ...saved });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch match details" },
      { status: 502 }
    );
  }
}
