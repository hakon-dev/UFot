import { getAllMatches } from "@/lib/db";

export const dynamic = "force-dynamic";

interface TeamRecord {
  team: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
}

export default function StatsPage() {
  const matches = getAllMatches();

  const totalMatches = matches.length;
  const totalGoals = matches.reduce((sum, m) => sum + m.home_score + m.away_score, 0);

  // Matches per competition
  const competitionCounts: Record<string, number> = {};
  for (const m of matches) {
    const comp = m.competition || "Unknown";
    competitionCounts[comp] = (competitionCounts[comp] || 0) + 1;
  }
  const competitions = Object.entries(competitionCounts)
    .sort((a, b) => b[1] - a[1]);

  // Team records
  const teamRecords: Record<string, TeamRecord> = {};
  function ensureTeam(name: string) {
    if (!teamRecords[name]) {
      teamRecords[name] = { team: name, played: 0, wins: 0, draws: 0, losses: 0 };
    }
  }

  for (const m of matches) {
    ensureTeam(m.home_team);
    ensureTeam(m.away_team);

    teamRecords[m.home_team].played++;
    teamRecords[m.away_team].played++;

    if (m.home_score > m.away_score) {
      teamRecords[m.home_team].wins++;
      teamRecords[m.away_team].losses++;
    } else if (m.away_score > m.home_score) {
      teamRecords[m.away_team].wins++;
      teamRecords[m.home_team].losses++;
    } else {
      teamRecords[m.home_team].draws++;
      teamRecords[m.away_team].draws++;
    }
  }

  const topTeams = Object.values(teamRecords)
    .sort((a, b) => b.played - a.played)
    .slice(0, 10);

  const cardClass = "bg-slate-800 rounded-xl p-6 border border-slate-700";

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Statistics</h1>

      {totalMatches === 0 ? (
        <p className="text-slate-400 text-lg text-center py-16">
          No matches watched yet. Add some matches to see your stats!
        </p>
      ) : (
        <div className="space-y-6">
          {/* Overview */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className={cardClass}>
              <p className="text-sm text-slate-400">Matches Watched</p>
              <p className="text-3xl font-bold text-emerald-400 mt-1">{totalMatches}</p>
            </div>
            <div className={cardClass}>
              <p className="text-sm text-slate-400">Total Goals Seen</p>
              <p className="text-3xl font-bold text-emerald-400 mt-1">{totalGoals}</p>
            </div>
            <div className={cardClass}>
              <p className="text-sm text-slate-400">Avg Goals/Match</p>
              <p className="text-3xl font-bold text-emerald-400 mt-1">
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
                      <span className="text-slate-400">{count}</span>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-2">
                      <div
                        className="bg-emerald-500 rounded-full h-2 transition-all"
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
                  <tr className="text-slate-400 border-b border-slate-700">
                    <th className="text-left pb-3 font-medium">Team</th>
                    <th className="text-center pb-3 font-medium">P</th>
                    <th className="text-center pb-3 font-medium">W</th>
                    <th className="text-center pb-3 font-medium">D</th>
                    <th className="text-center pb-3 font-medium">L</th>
                  </tr>
                </thead>
                <tbody>
                  {topTeams.map((t) => (
                    <tr key={t.team} className="border-b border-slate-700/50">
                      <td className="py-2.5 text-slate-200 font-medium">{t.team}</td>
                      <td className="py-2.5 text-center text-slate-300">{t.played}</td>
                      <td className="py-2.5 text-center text-emerald-400">{t.wins}</td>
                      <td className="py-2.5 text-center text-slate-400">{t.draws}</td>
                      <td className="py-2.5 text-center text-red-400">{t.losses}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
