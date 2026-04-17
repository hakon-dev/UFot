"use client";

import { useState } from "react";

export interface MatchSearchResult {
  id: number;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  competition: string;
  round: string;
  date: string;
  venue: string;
  homeCrest: string;
  awayCrest: string;
}

interface MatchSearchProps {
  onSelect: (match: MatchSearchResult) => void;
}

export default function MatchSearch({ onSelect }: MatchSearchProps) {
  const [date, setDate] = useState("");
  const [results, setResults] = useState<MatchSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);

  async function handleSearch() {
    if (!date) return;
    setLoading(true);
    setError("");
    setSearched(true);

    try {
      const res = await fetch(
        `/api/football?dateFrom=${date}&dateTo=${date}`
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to fetch matches");
      }
      const data = await res.json();
      setResults(data.matches);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSearch();
    }
  }

  return (
    <div className="bg-card rounded-xl p-6 border border-card-border space-y-4">
      <h2 className="text-lg font-semibold text-white">Find a Match</h2>
      <p className="text-sm text-muted">
        Search for a match by date to auto-fill the form. Covers major
        competitions (Premier League, La Liga, Serie A, Bundesliga, Ligue 1,
        Champions League, and more).
      </p>

      <div className="flex gap-3 items-end">
        <div className="flex-1 max-w-xs">
          <label
            htmlFor="searchDate"
            className="block text-sm font-medium text-slate-300 mb-1"
          >
            Match Date
          </label>
          <input
            id="searchDate"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full bg-surface border border-card-border rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
          />
        </div>
        <button
          type="button"
          onClick={handleSearch}
          disabled={!date || loading}
          className="bg-surface hover:bg-card-hover disabled:opacity-40 text-white font-medium px-5 py-2.5 rounded-lg transition-colors border border-card-border"
        >
          {loading ? "Searching..." : "Search"}
        </button>
      </div>

      {error && (
        <p className="text-red-400 text-sm">{error}</p>
      )}

      {searched && !loading && results.length === 0 && !error && (
        <p className="text-muted text-sm">
          No finished matches found for this date.
        </p>
      )}

      {results.length > 0 && (
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {results.map((match) => (
            <button
              key={match.id}
              type="button"
              onClick={() => onSelect(match)}
              className="w-full text-left bg-surface/50 hover:bg-card-hover border border-card-border hover:border-accent/30 rounded-lg p-3 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="text-white font-medium">
                  {match.homeTeam} {match.homeScore} &ndash; {match.awayScore}{" "}
                  {match.awayTeam}
                </div>
                <span className="text-xs text-muted ml-2 shrink-0">
                  {match.competition}
                </span>
              </div>
              {(match.round || match.venue) && (
                <div className="text-xs text-muted mt-1">
                  {[match.round, match.venue].filter(Boolean).join(" · ")}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
