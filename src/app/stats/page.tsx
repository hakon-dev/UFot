import { getAllMatches, getMatchesWithDetails } from "@/lib/db";
import { hydratePendingMatches } from "@/lib/match-hydration";
import { computePlayerStats, enrichPlayerStatsWithNationality } from "@/lib/player-stats";
import { enrichTeamRecordsWithCountry } from "@/lib/team-stats";
import PlayerStatsTable from "./PlayerStatsTable";
import CompetitionStatsTable, { type CompetitionStat } from "./CompetitionStatsTable";
import TeamStatsTable, { type TeamStat } from "./TeamStatsTable";

export const dynamic = "force-dynamic";

function minutesOf(rawIntervals: string | null): number {
  try {
    const intervals: number[][] = JSON.parse(rawIntervals || "[[0,90]]");
    return intervals.reduce((s, [a, b]) => s + (b - a), 0);
  } catch {
    return 90;
  }
}

export default async function StatsPage() {
  // Backfill any matches whose details never landed (failed POST-time hydration, transient API
  // errors). Bounded per load to respect the 100/day api-football budget — 5 matches = 15 req.
  await hydratePendingMatches(5);

  const matches = getAllMatches();

  const totalMatches = matches.length;
  const totalGoals = matches.reduce((sum, m) => sum + m.home_score + m.away_score, 0);
  const totalMinutesWatched = matches.reduce((sum, m) => sum + minutesOf(m.watch_intervals), 0);

  const matchesWithDetails = getMatchesWithDetails();
  const playerStats = computePlayerStats(matchesWithDetails);
  await enrichPlayerStatsWithNationality(playerStats);

  // Competition aggregation: matches + minutes per competition.
  const compMap = new Map<string, CompetitionStat>();
  for (const m of matches) {
    const comp = m.competition || "Unknown";
    const mins = minutesOf(m.watch_intervals);
    const existing = compMap.get(comp);
    if (existing) {
      existing.matches += 1;
      existing.minutes += mins;
    } else {
      compMap.set(comp, { competition: comp, matches: 1, minutes: mins });
    }
  }
  const competitions = [...compMap.values()];

  // Team aggregation: matches, minutes, goals-for, goals-against per team.
  const teamMap = new Map<string, TeamStat>();
  function ensureTeam(name: string, crest: string | null, teamId: number | null): TeamStat {
    let rec = teamMap.get(name);
    if (!rec) {
      rec = {
        team: name,
        teamId,
        crest,
        country: null,
        countryCode: null,
        matches: 0,
        minutes: 0,
        goalsFor: 0,
        goalsAgainst: 0,
      };
      teamMap.set(name, rec);
    } else {
      if (!rec.crest && crest) rec.crest = crest;
      if (rec.teamId == null && teamId != null) rec.teamId = teamId;
    }
    return rec;
  }

  for (const m of matches) {
    const mins = minutesOf(m.watch_intervals);
    const home = ensureTeam(m.home_team, m.home_crest, m.home_team_id);
    const away = ensureTeam(m.away_team, m.away_crest, m.away_team_id);
    home.matches += 1;
    home.minutes += mins;
    home.goalsFor += m.home_score;
    home.goalsAgainst += m.away_score;
    away.matches += 1;
    away.minutes += mins;
    away.goalsFor += m.away_score;
    away.goalsAgainst += m.home_score;
  }

  const teams = [...teamMap.values()];
  await enrichTeamRecordsWithCountry(teams);

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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className={cardClass}>
              <p className="text-sm text-muted">Matches Watched</p>
              <p className="text-3xl font-bold text-accent mt-1">{totalMatches}</p>
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

          {/* Most Watched Competitions */}
          <div className={cardClass}>
            <h2 className="text-lg font-semibold text-white mb-4">Most Watched Competitions</h2>
            <CompetitionStatsTable competitions={competitions} />
          </div>

          {/* Most Watched Teams */}
          <div className={cardClass}>
            <h2 className="text-lg font-semibold text-white mb-4">Most Watched Teams</h2>
            <TeamStatsTable teams={teams} />
          </div>

          {/* Most Watched Players */}
          {playerStats.length > 0 && (
            <div className={cardClass}>
              <h2 className="text-lg font-semibold text-white mb-4">Most Watched Players</h2>
              <PlayerStatsTable players={playerStats} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
