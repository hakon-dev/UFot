import { NextRequest, NextResponse } from "next/server";
import { searchMatchesByDate } from "@/lib/football-api";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const timeZone = searchParams.get("timeZone") || "UTC";

  if (!dateFrom || !dateTo) {
    return NextResponse.json(
      { error: "dateFrom and dateTo are required" },
      { status: 400 }
    );
  }

  // Validate date format (YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateFrom) || !dateRegex.test(dateTo)) {
    return NextResponse.json(
      { error: "Dates must be in YYYY-MM-DD format" },
      { status: 400 }
    );
  }

  try {
    const matches = await searchMatchesByDate(dateFrom, dateTo, timeZone);
    return NextResponse.json({ matches });
  } catch (error) {
    console.error("Football API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch matches" },
      { status: 502 }
    );
  }
}
