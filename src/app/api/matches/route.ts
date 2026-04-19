import { getAllMatches, createMatch } from "@/lib/db";
import { hydrateMatchDetails } from "@/lib/match-hydration";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const matches = getAllMatches();
  return NextResponse.json(matches);
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  const match = createMatch({
    homeTeam: body.homeTeam,
    awayTeam: body.awayTeam,
    homeScore: parseInt(body.homeScore),
    awayScore: parseInt(body.awayScore),
    competition: body.competition || undefined,
    round: body.round || undefined,
    date: body.date,
    venue: body.venue || undefined,
    homeCrest: body.homeCrest || undefined,
    awayCrest: body.awayCrest || undefined,
    externalMatchId: body.externalMatchId || undefined,
    externalSource: body.externalSource || undefined,
    watchIntervals: body.watchIntervals || undefined,
    homeTeamId: body.homeTeamId || undefined,
    awayTeamId: body.awayTeamId || undefined,
  });

  // Eager-fetch details so stats/player/team aggregations see this match immediately —
  // relying on a match-detail-page visit to trigger the fetch meant that any user who
  // navigated away (e.g. back to /add) before the detail page's useEffect fired would
  // leave the row stuck at `details_fetched=0`, invisible to aggregation. If the fetch
  // fails transiently we swallow the error so the POST still succeeds; the stats-page
  // rescue pass will retry later.
  if (match.external_source === "api-football") {
    await hydrateMatchDetails(match.id);
  }

  return NextResponse.json(match, { status: 201 });
}
