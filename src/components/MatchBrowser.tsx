"use client";

import Link from "next/link";
import { useEffect, useState, useCallback, useMemo } from "react";
import { getCompetitionSortKey } from "@/lib/competition-order";

interface MatchSearchResult {
  id: number;
  homeTeam: string;
  awayTeam: string;
  homeTeamId: number;
  awayTeamId: number;
  homeScore: number | null;
  awayScore: number | null;
  competition: string;
  competitionCode: string;
  competitionEmblem: string;
  round: string;
  date: string;
  venue: string;
  homeCrest: string;
  awayCrest: string;
}

interface CompetitionGroup {
  code: string;
  name: string;
  emblem: string;
  matches: MatchSearchResult[];
}

function groupByCompetition(matches: MatchSearchResult[]): CompetitionGroup[] {
  const groups = new Map<string, CompetitionGroup>();

  for (const match of matches) {
    const key = match.competitionCode;
    if (!groups.has(key)) {
      groups.set(key, {
        code: key,
        name: match.competition,
        emblem: match.competitionEmblem,
        matches: [],
      });
    }
    groups.get(key)!.matches.push(match);
  }

  return [...groups.values()].sort(
    (a, b) => getCompetitionSortKey(a.code) - getCompetitionSortKey(b.code)
  );
}

function todayDate(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(isoDate: string, delta: number): string {
  const [y, m, d] = isoDate.split("-").map((n) => parseInt(n, 10));
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + delta);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function formatDateLabel(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map((n) => parseInt(n, 10));
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function MatchBrowser() {
  const [date, setDate] = useState(todayDate);
  const [matches, setMatches] = useState<MatchSearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [addedMatchIds, setAddedMatchIds] = useState<Map<number, string>>(new Map());

  const today = useMemo(() => todayDate(), []);

  const fetchMatches = useCallback(async (d: string) => {
    setLoading(true);
    setError("");
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const res = await fetch(
        `/api/football?dateFrom=${d}&dateTo=${d}&timeZone=${encodeURIComponent(tz)}`
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to fetch matches");
      }
      const data = await res.json();
      setMatches(data.matches);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setMatches([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load the DB-known external IDs so we can render "already added" rows with a link into /matches/[id].
  useEffect(() => {
    fetch("/api/matches")
      .then((r) => r.ok ? r.json() : [])
      .then((rows: { id: string; external_match_id: number | null; external_source: string | null }[]) => {
        const map = new Map<number, string>();
        for (const row of rows) {
          if (row.external_match_id != null && row.external_source === "api-football") {
            map.set(row.external_match_id, row.id);
          }
        }
        setAddedMatchIds(map);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchMatches(date);
  }, [date, fetchMatches]);

  // Stash the summary for the preview page so it can render without another API round-trip.
  function stashSummary(match: MatchSearchResult) {
    try {
      sessionStorage.setItem(`fixture:${match.id}`, JSON.stringify(match));
    } catch {
      // sessionStorage disabled — preview page will fall back to the summary endpoint.
    }
  }

  const groups = groupByCompetition(matches);
  const isToday = date === today;

  return (
    <div className="space-y-6">
      {/* Date picker: arrows primary, calendar secondary. */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => setDate((d) => addDays(d, -1))}
          className="w-9 h-9 rounded-lg border border-card-border bg-surface text-slate-200 hover:text-accent hover:border-accent/40 transition-colors flex items-center justify-center"
          aria-label="Previous day"
        >
          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M12.707 4.293a1 1 0 010 1.414L8.414 10l4.293 4.293a1 1 0 01-1.414 1.414l-5-5a1 1 0 010-1.414l5-5a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </button>
        <div className="min-w-[12rem] text-center px-3 py-2 rounded-lg border border-card-border bg-surface text-white font-medium tabular-nums">
          {formatDateLabel(date)}
        </div>
        <button
          type="button"
          onClick={() => setDate((d) => addDays(d, 1))}
          className="w-9 h-9 rounded-lg border border-card-border bg-surface text-slate-200 hover:text-accent hover:border-accent/40 transition-colors flex items-center justify-center"
          aria-label="Next day"
        >
          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M7.293 15.707a1 1 0 010-1.414L11.586 10 7.293 5.707a1 1 0 011.414-1.414l5 5a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0z" clipRule="evenodd" />
          </svg>
        </button>

        {/* Secondary: calendar picker */}
        <label className="relative inline-flex items-center">
          <span className="w-9 h-9 rounded-lg border border-card-border bg-surface text-slate-400 hover:text-accent hover:border-accent/40 transition-colors flex items-center justify-center cursor-pointer">
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M6 2a1 1 0 011 1v1h6V3a1 1 0 112 0v1h1a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2h1V3a1 1 0 011-1zm-2 6v8h12V8H4z" clipRule="evenodd" />
            </svg>
          </span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="absolute inset-0 opacity-0 cursor-pointer"
            aria-label="Pick date"
          />
        </label>

        {!isToday && (
          <button
            type="button"
            onClick={() => setDate(today)}
            className="text-xs px-3 py-1.5 rounded-full border border-card-border text-slate-300 hover:text-accent hover:border-accent/40 transition-colors"
          >
            Today
          </button>
        )}

        {!loading && (
          <span className="text-muted text-sm ml-auto">
            {matches.length} {matches.length === 1 ? "match" : "matches"}
          </span>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-3 text-muted py-8">
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading matches...
        </div>
      )}

      {/* Error */}
      {error && <p className="text-red-400 text-sm">{error}</p>}

      {/* Empty state */}
      {!loading && !error && matches.length === 0 && (
        <p className="text-muted text-sm py-4">
          No finished matches found for this date.
        </p>
      )}

      {/* Grouped match list */}
      {groups.map((group) => (
        <div key={group.code}>
          {/* Competition header */}
          <div className="flex items-center gap-2.5 mb-2 sticky top-0 bg-background/80 backdrop-blur-sm py-2 z-10">
            {group.emblem && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={group.emblem}
                alt=""
                className="w-5 h-5 object-contain"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            )}
            <h3 className="text-sm font-semibold text-muted uppercase tracking-wide">
              {group.name}
            </h3>
          </div>

          {/* Match rows */}
          <div className="space-y-1.5">
            {group.matches.map((match) => {
              const internalId = addedMatchIds.get(match.id);
              const added = internalId != null;
              const href = added ? `/matches/${internalId}` : `/fixtures/${match.id}`;

              return (
                <Link
                  key={match.id}
                  href={href}
                  onClick={() => {
                    if (!added) stashSummary(match);
                  }}
                  className={`block w-full text-left rounded-lg p-3 transition-colors border ${
                    added
                      ? "bg-surface/30 border-accent/30 hover:border-accent/60"
                      : "bg-surface/50 hover:bg-card-hover border-card-border hover:border-accent/30"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Home team */}
                    <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                      <span className="text-sm text-white truncate text-right">
                        {match.homeTeam}
                      </span>
                      {match.homeCrest ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={match.homeCrest}
                          alt=""
                          className="w-6 h-6 object-contain shrink-0"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                      ) : (
                        <div className="w-6 h-6 shrink-0" />
                      )}
                    </div>

                    {/* Score */}
                    <div className="text-white font-bold tabular-nums shrink-0 w-14 text-center">
                      {match.homeScore ?? "-"} - {match.awayScore ?? "-"}
                    </div>

                    {/* Away team */}
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {match.awayCrest ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={match.awayCrest}
                          alt=""
                          className="w-6 h-6 object-contain shrink-0"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                      ) : (
                        <div className="w-6 h-6 shrink-0" />
                      )}
                      <span className="text-sm text-white truncate">
                        {match.awayTeam}
                      </span>
                    </div>

                    {/* Status indicator */}
                    <div className="shrink-0 w-6 h-6 flex items-center justify-center" aria-hidden="true">
                      {added ? (
                        <svg className="h-5 w-5 text-accent" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <svg className="h-4 w-4 text-muted/50" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M7.293 15.707a1 1 0 010-1.414L11.586 10 7.293 5.707a1 1 0 011.414-1.414l5 5a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                  </div>

                  {/* Round / venue info */}
                  {(match.round || match.venue) && (
                    <div className="text-xs text-muted mt-1 pl-1">
                      {[match.round, match.venue].filter(Boolean).join(" · ")}
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
