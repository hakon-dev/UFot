"use client";

import { useEffect, useState, useCallback } from "react";
import { getCompetitionSortKey } from "@/lib/competition-order";

interface MatchSearchResult {
  id: number;
  homeTeam: string;
  awayTeam: string;
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

export default function MatchBrowser() {
  const [date, setDate] = useState(todayDate);
  const [matches, setMatches] = useState<MatchSearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [addedIds, setAddedIds] = useState<Set<number>>(new Set());
  const [addingId, setAddingId] = useState<number | null>(null);

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

  useEffect(() => {
    fetchMatches(date);
  }, [date, fetchMatches]);

  async function handleAdd(match: MatchSearchResult) {
    if (addedIds.has(match.id) || addingId !== null) return;
    setAddingId(match.id);

    try {
      const res = await fetch("/api/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          homeTeam: match.homeTeam,
          awayTeam: match.awayTeam,
          homeScore: match.homeScore != null ? String(match.homeScore) : "0",
          awayScore: match.awayScore != null ? String(match.awayScore) : "0",
          competition: match.competition,
          round: match.round,
          date: match.date,
          venue: match.venue,
          homeCrest: match.homeCrest,
          awayCrest: match.awayCrest,
        }),
      });
      if (res.ok) {
        setAddedIds((prev) => new Set(prev).add(match.id));
      }
    } finally {
      setAddingId(null);
    }
  }

  const groups = groupByCompetition(matches);

  return (
    <div className="space-y-6">
      {/* Date picker */}
      <div className="flex items-center gap-4">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="bg-surface border border-card-border rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
        />
        {!loading && (
          <span className="text-muted text-sm">
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
              const added = addedIds.has(match.id);
              const adding = addingId === match.id;

              return (
                <button
                  key={match.id}
                  type="button"
                  onClick={() => handleAdd(match)}
                  disabled={added || adding}
                  className={`w-full text-left rounded-lg p-3 transition-colors border ${
                    added
                      ? "bg-surface/30 border-accent/30 opacity-60"
                      : "bg-surface/50 hover:bg-card-hover border-card-border hover:border-accent/30 cursor-pointer"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Home team */}
                    <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                      <span className="text-sm text-white truncate text-right">
                        {match.homeTeam}
                      </span>
                      {match.homeCrest ? (
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

                    {/* Add indicator */}
                    <div className="shrink-0 w-6 h-6 flex items-center justify-center">
                      {adding ? (
                        <svg className="animate-spin h-4 w-4 text-muted" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      ) : added ? (
                        <svg className="h-5 w-5 text-accent" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <svg className="h-5 w-5 text-muted/50" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
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
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
