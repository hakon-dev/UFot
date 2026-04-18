import { getMatch } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import MatchDetailClient from "./MatchDetailClient";

export const dynamic = "force-dynamic";

export default async function MatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const match = getMatch(id);
  if (!match) notFound();

  const dateStr = new Date(match.date).toLocaleDateString("en-GB", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  let watchIntervals: number[][];
  try {
    watchIntervals = JSON.parse(match.watch_intervals || "[[0,90]]");
  } catch {
    watchIntervals = [[0, 90]];
  }

  const minutes = watchIntervals.reduce((sum, [s, e]) => sum + (e - s), 0);

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link href="/" className="text-sm text-muted hover:text-accent transition-colors inline-flex items-center gap-1.5">
        <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
        </svg>
        Back to feed
      </Link>

      {/* Match header */}
      <div className="bg-card rounded-xl p-6 border border-card-border space-y-4">
        <p className="text-muted text-sm">
          {minutes < 90 ? `You watched ${minutes} min on ` : "You watched on "}
          <span className="text-slate-300">{dateStr}</span>
        </p>

        {/* Teams and score */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {match.home_crest && (
              <img src={match.home_crest} alt={match.home_team} className="w-10 h-10 object-contain" />
            )}
            <span className={`font-bold text-xl truncate ${match.home_score > match.away_score ? "text-accent" : "text-slate-200"}`}>
              {match.home_team}
            </span>
          </div>

          <div className="text-3xl font-bold text-white tabular-nums shrink-0 px-3">
            {match.home_score} - {match.away_score}
          </div>

          <div className="flex items-center gap-3 flex-1 min-w-0 justify-end">
            <span className={`font-bold text-xl truncate text-right ${match.away_score > match.home_score ? "text-accent" : "text-slate-200"}`}>
              {match.away_team}
            </span>
            {match.away_crest && (
              <img src={match.away_crest} alt={match.away_team} className="w-10 h-10 object-contain" />
            )}
          </div>
        </div>

        {/* Metadata */}
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
          {match.competition && (
            <span className="bg-accent-muted text-accent-dim px-2 py-0.5 rounded-full">
              {match.competition}
            </span>
          )}
          {match.round && <span>{match.round}</span>}
          {match.venue && <span>{match.venue}</span>}
        </div>
      </div>

      {/* Client-side: details + intervals */}
      <MatchDetailClient
        matchId={match.id}
        canFetchDetails={match.external_match_id !== null && match.external_source === "api-football"}
        initialIntervals={watchIntervals}
        homeTeam={match.home_team}
        awayTeam={match.away_team}
        homeTeamId={match.home_team_id}
        awayTeamId={match.away_team_id}
      />
    </div>
  );
}
