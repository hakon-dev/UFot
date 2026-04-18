import Link from "next/link";
import { notFound } from "next/navigation";
import { getTeamProfile, getTeamPlayers } from "@/lib/team-stats";
import { enrichPlayerStatsWithNationality } from "@/lib/player-stats";
import PlayerStatsTable from "@/app/stats/PlayerStatsTable";

export const dynamic = "force-dynamic";

export default async function TeamPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
  const idNum = parseInt(teamId, 10);
  if (!Number.isFinite(idNum)) notFound();
  const team = getTeamProfile(idNum);
  if (!team) notFound();

  const teamPlayers = getTeamPlayers(idNum);
  await enrichPlayerStatsWithNationality(teamPlayers);

  const cardClass = "bg-card rounded-xl p-5 border border-card-border";

  return (
    <div className="space-y-6">
      <Link href="/stats" className="text-sm text-muted hover:text-accent transition-colors inline-flex items-center gap-1.5">
        <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
        </svg>
        Back to stats
      </Link>

      <div className={cardClass}>
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={team.crestUrl}
            alt={team.name}
            className="w-16 h-16 object-contain"
          />
          <div>
            <h1 className="text-2xl font-bold text-white">{team.name}</h1>
            <p className="text-sm text-muted">
              {team.totalMatches} match{team.totalMatches === 1 ? "" : "es"} watched
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Wins" value={team.wins} />
        <StatCard label="Draws" value={team.draws} />
        <StatCard label="Losses" value={team.losses} />
        <StatCard label="Eq. Matches" value={(team.totalMinutes / 90).toFixed(1)} />
        <StatCard label="Goals For" value={team.goalsFor} />
        <StatCard label="Goals Against" value={team.goalsAgainst} />
        <StatCard label="Goal Diff" value={team.goalsFor - team.goalsAgainst >= 0 ? `+${team.goalsFor - team.goalsAgainst}` : `${team.goalsFor - team.goalsAgainst}`} />
        <StatCard label="Minutes" value={team.totalMinutes} />
      </div>

      {teamPlayers.length > 0 && (
        <div className={cardClass}>
          <h2 className="text-lg font-semibold text-white mb-4">Most Watched Players</h2>
          <PlayerStatsTable players={teamPlayers} />
        </div>
      )}

      <div className={cardClass}>
        <h2 className="text-lg font-semibold text-white mb-4">Matches Watched</h2>
        <div className="space-y-2">
          {team.appearances.map((a) => {
            const myGoals = a.isHome ? a.homeScore : a.awayScore;
            const theirGoals = a.isHome ? a.awayScore : a.homeScore;
            const resultColor =
              myGoals > theirGoals ? "text-accent" : myGoals < theirGoals ? "text-red-400" : "text-slate-300";
            const resultLetter = myGoals > theirGoals ? "W" : myGoals < theirGoals ? "L" : "D";
            return (
              <Link
                key={a.matchId}
                href={`/matches/${a.matchId}`}
                className="flex items-center gap-3 text-sm hover:bg-surface rounded-lg px-2 py-2 transition-colors"
              >
                <span className={`w-5 text-center font-bold ${resultColor}`}>{resultLetter}</span>
                <div className="flex-1 min-w-0 flex items-center gap-2">
                  {a.homeCrest && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.homeCrest} alt={a.homeTeam} className="w-4 h-4 object-contain" />
                  )}
                  <span className="truncate text-slate-200">{a.homeTeam}</span>
                  <span className="text-muted tabular-nums px-1">
                    {a.homeScore} - {a.awayScore}
                  </span>
                  <span className="truncate text-slate-200">{a.awayTeam}</span>
                  {a.awayCrest && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.awayCrest} alt={a.awayTeam} className="w-4 h-4 object-contain" />
                  )}
                </div>
                <span className="text-xs text-muted shrink-0">{a.minutesWatched} min</span>
                <span className="text-xs text-muted shrink-0 tabular-nums">
                  {new Date(a.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-card rounded-xl p-4 border border-card-border">
      <p className="text-xs text-muted">{label}</p>
      <p className="text-2xl font-bold text-accent mt-1 tabular-nums">{value}</p>
    </div>
  );
}
