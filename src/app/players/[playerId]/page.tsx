import Link from "next/link";
import { notFound } from "next/navigation";
import { getPlayerProfile } from "@/lib/player-stats";
import PlayerPhoto from "./PlayerPhoto";

export const dynamic = "force-dynamic";

export default async function PlayerPage({
  params,
}: {
  params: Promise<{ playerId: string }>;
}) {
  const { playerId } = await params;
  const idNum = parseInt(playerId, 10);
  if (!Number.isFinite(idNum)) notFound();
  const player = getPlayerProfile(idNum);
  if (!player) notFound();

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
          <PlayerPhoto src={player.photoUrl} name={player.name} size="lg" />
          <div>
            <h1 className="text-2xl font-bold text-white">{player.name}</h1>
            <p className="text-sm text-muted">
              {player.totalMatches} match{player.totalMatches === 1 ? "" : "es"} watched
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard label="Minutes" value={player.totalMinutes} />
        <StatCard label="Matches" value={player.totalMatches} />
        <StatCard label="Goals" value={player.totalGoals} />
        <StatCard label="Assists" value={player.totalAssists} />
        <StatCard label="Yellows" value={player.totalYellows} accent="yellow" />
        <StatCard label="Reds" value={player.totalReds} accent="red" />
      </div>

      <div className={cardClass}>
        <h2 className="text-lg font-semibold text-white mb-4">Appearances</h2>
        <div className="space-y-2">
          {player.appearances.map((a) => (
            <Link
              key={a.matchId}
              href={`/matches/${a.matchId}`}
              className="flex items-center gap-3 text-sm hover:bg-surface rounded-lg px-2 py-2 transition-colors"
            >
              <div className="flex-1 min-w-0 flex items-center gap-2">
                {a.homeCrest && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.homeCrest} alt={a.homeTeam} className="w-4 h-4 object-contain" />
                )}
                <span className={`truncate ${a.team === "home" ? "text-accent" : "text-slate-200"}`}>
                  {a.homeTeam}
                </span>
                <span className="text-muted tabular-nums px-1">
                  {a.homeScore} - {a.awayScore}
                </span>
                <span className={`truncate ${a.team === "away" ? "text-accent" : "text-slate-200"}`}>
                  {a.awayTeam}
                </span>
                {a.awayCrest && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.awayCrest} alt={a.awayTeam} className="w-4 h-4 object-contain" />
                )}
              </div>
              <span className="text-xs text-muted shrink-0 tabular-nums">{a.minutesWatched} min</span>
              {a.goalsWatched > 0 && (
                <span className="text-xs text-accent shrink-0 tabular-nums">
                  {a.goalsWatched}G
                </span>
              )}
              {a.assistsWatched > 0 && (
                <span className="text-xs text-muted shrink-0 tabular-nums">
                  {a.assistsWatched}A
                </span>
              )}
              {a.yellowsWatched > 0 && (
                <span className="text-xs text-yellow-400 shrink-0 tabular-nums">
                  {a.yellowsWatched}Y
                </span>
              )}
              {a.redsWatched > 0 && (
                <span className="text-xs text-red-400 shrink-0 tabular-nums">
                  {a.redsWatched}R
                </span>
              )}
              <span className="text-xs text-muted shrink-0 tabular-nums">
                {new Date(a.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent = "accent",
}: {
  label: string;
  value: string | number;
  accent?: "accent" | "yellow" | "red";
}) {
  const color =
    accent === "yellow" ? "text-yellow-400" : accent === "red" ? "text-red-400" : "text-accent";
  return (
    <div className="bg-card rounded-xl p-4 border border-card-border">
      <p className="text-xs text-muted">{label}</p>
      <p className={`text-2xl font-bold mt-1 tabular-nums ${color}`}>{value}</p>
    </div>
  );
}
