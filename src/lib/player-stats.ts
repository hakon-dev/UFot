import type { Match, MatchGoal, MatchSubstitution, MatchLineup } from "./db";

export interface PlayerStat {
  name: string;
  minutesWatched: number;
  matches: number;
  goalsWatched: number;
  assistsWatched: number;
}

type MatchWithDetails = Match & {
  goals: MatchGoal[];
  substitutions: MatchSubstitution[];
  lineups: MatchLineup[];
};

function intervalOverlap(playerStart: number, playerEnd: number, watchIntervals: number[][]): number {
  let total = 0;
  for (const [ws, we] of watchIntervals) {
    total += Math.max(0, Math.min(playerEnd, we) - Math.max(playerStart, ws));
  }
  return total;
}

function minuteInIntervals(minute: number, intervals: number[][]): boolean {
  return intervals.some(([s, e]) => minute >= s && minute <= e);
}

export function computePlayerStats(matches: MatchWithDetails[]): PlayerStat[] {
  const stats = new Map<string, PlayerStat>();

  function ensure(name: string): PlayerStat {
    let s = stats.get(name);
    if (!s) {
      s = { name, minutesWatched: 0, matches: 0, goalsWatched: 0, assistsWatched: 0 };
      stats.set(name, s);
    }
    return s;
  }

  for (const match of matches) {
    let watchIntervals: number[][];
    try {
      watchIntervals = JSON.parse(match.watch_intervals || "[[0,90]]");
    } catch {
      watchIntervals = [[0, 90]];
    }

    // Build a map of sub events for quick lookup
    const subbedOut = new Map<string, number>(); // playerName -> minute
    const subbedIn = new Map<string, number>();  // playerName -> minute

    for (const sub of match.substitutions) {
      subbedOut.set(sub.player_out, sub.minute);
      subbedIn.set(sub.player_in, sub.minute);
    }

    // Compute per-player playing interval and overlap with watch intervals
    for (const lineup of match.lineups) {
      let playerStart: number;
      let playerEnd: number;

      if (lineup.is_starter === 1) {
        playerStart = 0;
        playerEnd = subbedOut.get(lineup.player_name) ?? 90;
      } else {
        // Bench player
        const subInMinute = subbedIn.get(lineup.player_name);
        if (subInMinute === undefined) continue; // Never entered the pitch
        playerStart = subInMinute;
        playerEnd = subbedOut.get(lineup.player_name) ?? 90;
      }

      const overlap = intervalOverlap(playerStart, playerEnd, watchIntervals);
      if (overlap > 0) {
        const stat = ensure(lineup.player_name);
        stat.minutesWatched += overlap;
        stat.matches += 1;
      }
    }

    // Count goals and assists the user watched
    for (const goal of match.goals) {
      if (!minuteInIntervals(goal.minute, watchIntervals)) continue;

      if (goal.type !== "OWN_GOAL") {
        const scorerStat = ensure(goal.scorer_name);
        scorerStat.goalsWatched += 1;
      }
      if (goal.assist_name) {
        const assistStat = ensure(goal.assist_name);
        assistStat.assistsWatched += 1;
      }
    }
  }

  return [...stats.values()].sort((a, b) => b.minutesWatched - a.minutesWatched);
}
