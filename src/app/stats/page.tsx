import { getAllMatches, getMatchesWithDetails } from "@/lib/db";
import { computePlayerStats } from "@/lib/player-stats";
import PlayerStatsTable from "./PlayerStatsTable";

export const dynamic = "force-dynamic";

interface TeamRecord {
  team: string;
  crest: string | null;
  minutes: number;
}

export default function StatsPage() {
  const matches = getAllMatches();

  const totalMatches = matches.length;
  const totalGoals = matches.reduce((sum, m) => sum + m.home_score + m.away_score, 0);

  // Watch minutes calculation
  const totalMinutesWatched = matches.reduce((sum, m) => {
    try {
      const intervals: number[][] = JSON.parse(m.watch_intervals || "[[0,90]]");
      return sum + intervals.reduce((s, [a, b]) => s + (b - a), 0);
    } catch {
      return sum + 90;
    }
  }, 0);
  const equivalentMatches = totalMinutesWatched / 90;

  // Player stats
  const matchesWithDetails = getMatchesWithDetails();
  const playerStats = computePlayerStats(matchesWithDetails);

  // Matches per competition
  const competitionCounts: Record<string, number> = {};
  for (const m of matches) {
    const comp = m.competition || "Unknown";
    competitionCounts[comp] = (competitionCounts[comp] || 0) + 1;
  }
  const competitions = Object.entries(competitionCounts)
    .sort((a, b) => b[1] - a[1]);

  // Team records: equivalent matches watched per team
  const teamRecords: Record<string, TeamRecord> = {};
  function ensureTeam(name: string, crest: string | null) {
    if (!teamRecords[name]) {
      teamRecords[name] = { team: name, crest, minutes: 0 };
    } else if (!teamRecords[name].crest && crest) {
      teamRecords[name].crest = crest;
    }
  }

  for (const m of matches) {
    let matchMinutes: number;
    try {
      const intervals: number[][] = JSON.parse(m.watch_intervals || "[[0,90]]");
      matchMinutes = intervals.reduce((s, [a, b]) => s + (b - a), 0);
    } catch {
      matchMinutes = 90;
    }

    ensureTeam(m.home_team, m.home_crest);
    ensureTeam(m.away_team, m.away_crest);

    teamRecords[m.home_team].minutes += matchMinutes;
    teamRecords[m.away_team].minutes += matchMinutes;
  }

  const topTeams = Object.values(teamRecords)
    .sort((a, b) => b.minutes - a.minutes);

  const cardClass = "bg-card rounded-xl p-6 border border-card-border";

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Statistics</h1>

      {totalMatches === 0 ? (
        <p className="text-muted text-lg text-center py-16">
          No matches watched yet. Add some matches to see your stats!
        </p>
      ) : (
        <div className="space-y-6">
          {/* Overview */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <div className={cardClass}>
              <p className="text-sm text-muted">Matches Watched</p>
              <p className="text-3xl font-bold text-accent mt-1">{totalMatches}</p>
            </div>
            <div className={cardClass}>
              <p className="text-sm text-muted">Equivalent Matches</p>
              <p className="text-3xl font-bold text-accent mt-1">{equivalentMatches.toFixed(1)}</p>
            </div>
            <div className={cardClass}>
              <p className="text-sm text-muted">Total Minutes</p>
              <p className="text-3xl font-bold text-accent mt-1">{totalMinutesWatched.toLocaleString()}</p>
            </div>
            <div className={cardClass}>
              <p className="text-sm text-muted">Total Goals Seen</p>
              <p className="text-3xl font-bold text-accent mt-1">{totalGoals}</p>
            </div>
            <div className={cardClass}>
              <p className="text-sm text-muted">Avg Goals/Match</p>
              <p className="text-3xl font-bold text-accent mt-1">
                {(totalGoals / totalMatches).toFixed(1)}
              </p>
            </div>
          </div>

          {/* Competitions */}
          <div className={cardClass}>
            <h2 className="text-lg font-semibold text-white mb-4">Matches by Competition</h2>
            <div className="space-y-3">
              {competitions.map(([comp, count]) => (
                <div key={comp} className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-300">{comp}</span>
                      <span className="text-muted">{count}</span>
                    </div>
                    <div className="w-full bg-surface rounded-full h-2">
                      <div
                        className="bg-accent rounded-full h-2 transition-all"
                        style={{ width: `${(count / totalMatches) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Most Watched Teams */}
          <div className={cardClass}>
            <h2 className="text-lg font-semibold text-white mb-4">Most Watched Teams</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted border-b border-card-border">
                    <th className="text-left pb-3 font-medium">Team</th>
                    <th className="text-right pb-3 font-medium">Eq. Matches</th>
                  </tr>
                </thead>
                <tbody>
                  {topTeams.map((t) => (
                    <tr key={t.team} className="border-b border-card-border/50">
                      <td className="py-2.5 text-slate-200 font-medium">
                        <div className="flex items-center gap-2.5">
                          {t.crest ? (
                            <img src={t.crest} alt={t.team} className="w-5 h-5 object-contain" />
                          ) : (
                            <svg className="w-5 h-5 text-muted/40" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M12 2L3 7v5c0 5.25 3.83 10.15 9 11.25C17.17 22.15 21 17.25 21 12V7l-9-5zm0 2.18l7 3.89v4.93c0 4.29-3.08 8.28-7 9.18-3.92-.9-7-4.89-7-9.18V8.07l7-3.89z" />
                            </svg>
                          )}
                          {t.team}
                        </div>
                      </td>
                      <td className="py-2.5 text-right text-accent tabular-nums">{(t.minutes / 90).toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Player Watch Stats */}
          {playerStats.length > 0 && (
            <div className={cardClass}>
              <h2 className="text-lg font-semibold text-white mb-4">Player Watch Stats</h2>
              <PlayerStatsTable players={playerStats} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
