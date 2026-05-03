import { getMatch, updateWatchIntervals } from "@/lib/db";
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
  const intervals: number[][] = body.intervals;

  // Validate intervals
  if (!Array.isArray(intervals) || intervals.length === 0) {
    return NextResponse.json({ error: "intervals must be a non-empty array" }, { status: 400 });
  }
  for (const interval of intervals) {
    if (
      !Array.isArray(interval) ||
      interval.length !== 2 ||
      typeof interval[0] !== "number" ||
      typeof interval[1] !== "number" ||
      interval[0] < 0 ||
      interval[1] > 120 ||
      interval[0] >= interval[1]
    ) {
      return NextResponse.json(
        { error: "Each interval must be [start, end] with 0 <= start < end <= 120" },
        { status: 400 }
      );
    }
  }

  updateWatchIntervals(id, intervals);
  return NextResponse.json({ success: true });
}
