"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Match } from "@/lib/db";
import { formatRound } from "@/lib/format-round";

function TeamCrest({ src, alt }: { src: string | null; alt: string }) {
  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        className="w-12 h-12 object-contain shrink-0"
      />
    );
  }

  return (
    <svg
      className="w-12 h-12 text-muted/50 shrink-0"
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M12 2L3 7v5c0 5.25 3.83 10.15 9 11.25C17.17 22.15 21 17.25 21 12V7l-9-5zm0 2.18l7 3.89v4.93c0 4.29-3.08 8.28-7 9.18-3.92-.9-7-4.89-7-9.18V8.07l7-3.89z" />
    </svg>
  );
}

function StadiumIcon() {
  return (
    <svg
      className="w-3.5 h-3.5 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 22s7-7.5 7-13a7 7 0 1 0-14 0c0 5.5 7 13 7 13z" />
      <circle cx="12" cy="9" r="2.5" />
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
  const hadExtraTime = match.had_extra_time === 1;
  const hadPenalties = match.had_penalties === 1;
  const watchedPenalties = match.watched_penalties === 1;
  const inPerson = match.watched_in_person === 1;
  // A 90-min match is "full" at 90; a 120-min match needs 120 to be "full".
  const fullMatchThreshold = hadExtraTime ? 120 : 90;
  const isFullMatch = minutes >= fullMatchThreshold;

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
  // In-person matches get an amber-tinted card so they stand out in the feed.
  const cardClass = inPerson
    ? "block bg-sky-500/20 rounded-xl p-6 border border-sky-400/70 hover:border-sky-400 transition-colors group"
    : "block bg-card rounded-xl p-6 border border-card-border hover:border-card-hover transition-colors group";
  return (
    <div className={cardClass}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0 space-y-5">
          <Link href={`/matches/${match.id}`} className="block space-y-4">
            {/* Watch description */}
            <p className="text-muted text-base">
              {isFullMatch ? "You watched the full match" : `You watched ${minutes} min`} on <span className="text-slate-300">{dateStr}</span>
              {hadExtraTime && (
                <span className="ml-2 text-[10px] uppercase tracking-wide font-semibold text-accent">
                  {hadPenalties ? "AET · Pens" : "AET"}
                </span>
              )}
              {hadPenalties && watchedPenalties && (
                <span className="ml-2 text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded border border-accent/40 text-accent bg-accent/10">
                  + pens
                </span>
              )}
            </p>

            {/* Teams centered with bigger crests */}
            <div className="flex items-center gap-5">
              <div className="flex items-center gap-3 flex-1 min-w-0 justify-end">
                <span className={`font-semibold text-xl truncate text-right ${match.home_score > match.away_score ? "text-accent" : "text-slate-200"}`}>
                  {match.home_team}
                </span>
                <TeamCrest src={match.home_crest} alt={match.home_team} />
              </div>

              <div className="text-3xl font-bold text-white tabular-nums shrink-0">
                {match.home_score} - {match.away_score}
              </div>

              <div className="flex items-center gap-3 flex-1 min-w-0">
                <TeamCrest src={match.away_crest} alt={match.away_team} />
                <span className={`font-semibold text-xl truncate ${match.away_score > match.home_score ? "text-accent" : "text-slate-200"}`}>
                  {match.away_team}
                </span>
              </div>
            </div>
          </Link>

          {/* Competition + round + venue + in-person */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            {match.competition && (
              match.competition_id != null ? (
                <Link
                  href={`/competitions/${match.competition_id}`}
                  className="inline-flex items-center gap-1.5 bg-accent-muted text-accent-dim pl-1 pr-2 py-0.5 rounded-full hover:text-accent transition-colors"
                >
                  {match.competition_logo && (
                    <img
                      src={match.competition_logo}
                      alt=""
                      className="w-4 h-4 object-contain bg-white/90 rounded-full p-0.5"
                    />
                  )}
                  {match.competition}
                </Link>
              ) : (
                <span className="inline-flex items-center gap-1.5 bg-accent-muted text-accent-dim pl-1 pr-2 py-0.5 rounded-full">
                  {match.competition_logo && (
                    <img
                      src={match.competition_logo}
                      alt=""
                      className="w-4 h-4 object-contain bg-white/90 rounded-full p-0.5"
                    />
                  )}
                  {match.competition}
                </span>
              )
            )}
            {formatRound(match.round) && <span className="text-muted">{formatRound(match.round)}</span>}

            {(match.venue || match.watched_in_person === 1) && (
              <div className="ml-auto inline-flex items-center gap-2">
                {match.venue && (
                  <Link
                    href={
                      match.venue_id != null
                        ? `/stadiums/${match.venue_id}`
                        : `/stadiums/by-name/${encodeURIComponent(match.venue)}`
                    }
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-card-border bg-surface text-slate-200 hover:text-accent hover:border-accent/40 transition-colors"
                  >
                    <StadiumIcon />
                    <span>
                      {match.venue}
                      {match.venue_city ? ` · ${match.venue_city}` : ""}
                    </span>
                  </Link>
                )}
                {inPerson && (
                  <span className="inline-flex items-center gap-1 uppercase tracking-wide text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sky-400 text-black">
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
                      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                    </svg>
                    In person
                  </span>
                )}
              </div>
            )}
          </div>

        </div>

        <button
          onClick={handleDelete}
          className="text-muted/40 hover:text-red-400 transition-colors p-1 opacity-0 group-hover:opacity-100 shrink-0"
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
