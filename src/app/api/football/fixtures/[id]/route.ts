import { NextRequest, NextResponse } from "next/server";
import { fetchFixtureSummary } from "@/lib/football-api";
import { getMatchByExternalId } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const fixtureId = parseInt(id, 10);
  if (!Number.isFinite(fixtureId)) {
    return NextResponse.json({ error: "Invalid fixture id" }, { status: 400 });
  }

  const timeZone = request.nextUrl.searchParams.get("timeZone") || "UTC";

  const existing = getMatchByExternalId(fixtureId, "api-football");

  try {
    const summary = await fetchFixtureSummary(fixtureId, timeZone);
    if (!summary) {
      return NextResponse.json({ error: "Fixture not found" }, { status: 404 });
    }
    return NextResponse.json({
      summary,
      existingMatchId: existing?.id ?? null,
    });
  } catch (error) {
    console.error("Football API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch fixture" },
      { status: 502 }
    );
  }
}
