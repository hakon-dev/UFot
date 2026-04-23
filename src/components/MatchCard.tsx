"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Match } from "@/lib/db";

function TeamCrest({ src, alt }: { src: string | null; alt: string }) {
  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        className="w-8 h-8 object-contain"
      />
    );
  }

  // Placeholder shield icon
  return (
    <svg
      className="w-8 h-8 text-muted/50"
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M12 2L3 7v5c0 5.25 3.83 10.15 9 11.25C17.17 22.15 21 17.25 21 12V7l-9-5zm0 2.18l7 3.89v4.93c0 4.29-3.08 8.28-7 9.18-3.92-.9-7-4.89-7-9.18V8.07l7-3.89z" />
    </svg>
  );
}

function getWatchMinutes(match: Match): number {
  try {
    const intervals: number[][] = JSON.parse(match.watch_intervals || "[[0,90]]");
    return intervals.reduce((sum, [s, e]) => sum + (e - s), 0);
  } catch {
    return 90;
  }
}

export default function MatchCard({ match }: { match: Match }) {
  const router = useRouter();
  const minutes = getWatchMinutes(match);

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Delete this match?")) return;

    await fetch(`/api/matches/${match.id}`, { method: "DELETE" });
    router.refresh();
  }

  const dateStr = new Date(match.date).toLocaleDateString("en-GB", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // The card is split into a main Link covering the score/teams area and sibling Links for the
  // competition badge — nesting <a> inside <a> is invalid HTML, so the outer wrapper is a div.
  return (
    <div className="block bg-card rounded-xl p-5 border border-card-border hover:border-card-hover transition-colors group">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-3">
          <Link href={`/matches/${match.id}`} className="block space-y-3">
            {/* Descriptive text */}
            <p className="text-muted text-sm">
              {minutes >= 90 ? "You watched the full match" : `You watched ${minutes} min`} on <span className="text-slate-300">{dateStr}</span>
              <span className="ml-2 inline-flex items-center bg-accent-muted text-accent-dim px-1.5 py-0.5 rounded text-xs tabular-nums">
                {minutes}&apos;
              </span>
            </p>

            {/* Teams with crests and score */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                <TeamCrest src={match.home_crest} alt={match.home_team} />
                <span className={`font-semibold text-lg truncate ${match.home_score > match.away_score ? "text-accent" : "text-slate-200"}`}>
                  {match.home_team}
                </span>
              </div>

              <div className="text-2xl font-bold text-white tabular-nums shrink-0 px-2">
                {match.home_score} - {match.away_score}
              </div>

              <div className="flex items-center gap-2.5 flex-1 min-w-0 justify-end">
                <span className={`font-semibold text-lg truncate text-right ${match.away_score > match.home_score ? "text-accent" : "text-slate-200"}`}>
                  {match.away_team}
                </span>
                <TeamCrest src={match.away_crest} alt={match.away_team} />
              </div>
            </div>
          </Link>

          {/* Metadata */}
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
            {match.competition && (
              match.competition_id != null ? (
                <Link
                  href={`/competitions/${match.competition_id}`}
                  className="bg-accent-muted text-accent-dim px-2 py-0.5 rounded-full hover:text-accent transition-colors"
                >
                  {match.competition}
                </Link>
              ) : (
                <span className="bg-accent-muted text-accent-dim px-2 py-0.5 rounded-full">
                  {match.competition}
                </span>
              )
            )}
            {match.round && <span>{match.round}</span>}
            {match.venue && (
              match.venue_id != null ? (
                <Link
                  href={`/stadiums/${match.venue_id}`}
                  className="hover:text-accent transition-colors"
                >
                  {match.venue}
                </Link>
              ) : (
                <span>{match.venue}</span>
              )
            )}
            {match.watched_in_person === 1 && (
              <span className="uppercase tracking-wide text-[10px] font-semibold px-1.5 py-0.5 rounded border border-accent/40 text-accent bg-accent/10">
                In person
              </span>
            )}
          </div>
        </div>

        <button
          onClick={handleDelete}
          className="text-muted/40 hover:text-red-400 transition-colors p-1 opacity-0 group-hover:opacity-100"
          aria-label="Delete match"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
    </div>
  );
}
