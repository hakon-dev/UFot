import { getMatch, updateMatchWatchedPenalties } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const match = getMatch(id);
  if (!match) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  const body = await request.json();
  if (typeof body.watchedPenalties !== "boolean") {
    return NextResponse.json(
      { error: "watchedPenalties must be a boolean" },
      { status: 400 }
    );
  }

  updateMatchWatchedPenalties(id, body.watchedPenalties);
  return NextResponse.json({ success: true });
}
