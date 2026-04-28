import type { Match } from "./db";

export type Gender = "men" | "women";

// Detect women's teams from the patterns API-Football encodes: trailing " W", " (W)",
// or "Women". Generalized version of classifyNationalTeam's gender check that works for
// clubs as well as national teams. "Werder Bremen" doesn't match because the regex
// requires the W to be preceded by a space and followed by a word boundary.
export function classifyTeamGender(name: string | null | undefined): Gender {
  if (!name) return "men";
  const isWomen =
    /\bwomen\b/i.test(name) || /\(w\)/i.test(name) || /\sw\b/i.test(name);
  return isWomen ? "women" : "men";
}

// A match is a women's match when either side is a women's team. Mixed games don't exist
// in practice, so an OR is correct.
export function matchGender(homeTeam: string, awayTeam: string): Gender {
  return classifyTeamGender(homeTeam) === "women" ||
    classifyTeamGender(awayTeam) === "women"
    ? "women"
    : "men";
}

function minutesOf(raw: string | null): number {
  try {
    const arr: number[][] = JSON.parse(raw || "[[0,90]]");
    return arr.reduce((s, [a, b]) => s + (b - a), 0);
  } catch {
    return 90;
  }
}

// Default gender for the stats UI: whichever side accounts for more total minutes
// watched. Ties fall to "men" so an empty install picks a stable default.
export function pickDefaultGender(matches: Match[]): Gender {
  let men = 0;
  let women = 0;
  for (const m of matches) {
    const mins = minutesOf(m.watch_intervals);
    if (matchGender(m.home_team, m.away_team) === "women") women += mins;
    else men += mins;
  }
  return women > men ? "women" : "men";
}
