import { getAllMatches, createMatch } from "@/lib/db";
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
    footballDataId: body.footballDataId || undefined,
    watchIntervals: body.watchIntervals || undefined,
  });

  return NextResponse.json(match, { status: 201 });
}
