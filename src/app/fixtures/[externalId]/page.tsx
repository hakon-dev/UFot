"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import WatchIntervalEditor from "@/components/WatchIntervalEditor";
import { formatRound } from "@/lib/format-round";

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
  venueId: number | null;
  venueCity: string | null;
  homeCrest: string;
  awayCrest: string;
}

function readSessionSummary(externalId: string): MatchSearchResult | null {
  try {
    const raw = sessionStorage.getItem(`fixture:${externalId}`);
    if (!raw) return null;
    return JSON.parse(raw) as MatchSearchResult;
  } catch {
    return null;
  }
}

export default function FixturePreviewPage() {
  const params = useParams<{ externalId: string }>();
  const router = useRouter();
  const externalId = params.externalId;

  const [summary, setSummary] = useState<MatchSearchResult | null>(null);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [intervals, setIntervals] = useState<number[][]>([[0, 90]]);
  const [watchedInPerson, setWatchedInPerson] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    if (!externalId) return;

    // Try the fast path first — MatchBrowser stashes the summary on click.
    const cached = readSessionSummary(externalId);
    if (cached) {
      setSummary(cached);
      setLoading(false);
      return;
    }

    // Deep-link / refresh path — hit the API.
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    fetch(`/api/football/fixtures/${externalId}?timeZone=${encodeURIComponent(tz)}`)
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to load fixture");
        }
        return res.json();
      })
      .then((data: { summary: MatchSearchResult; existingMatchId: string | null }) => {
        if (data.existingMatchId) {
          router.replace(`/matches/${data.existingMatchId}`);
          return;
        }
        setSummary(data.summary);
      })
      .catch((err) => {
        setLoadError(err instanceof Error ? err.message : "Failed to load fixture");
      })
      .finally(() => setLoading(false));
  }, [externalId, router]);

  async function handleConfirm() {
    if (!summary || saving) return;
    setSaving(true);
    setSaveError("");
    try {
      const res = await fetch("/api/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          homeTeam: summary.homeTeam,
          awayTeam: summary.awayTeam,
          homeScore: summary.homeScore != null ? String(summary.homeScore) : "0",
          awayScore: summary.awayScore != null ? String(summary.awayScore) : "0",
          competition: summary.competition,
          round: summary.round,
          date: summary.date,
          venue: summary.venue,
          venueId: summary.venueId ?? undefined,
          venueCity: summary.venueCity ?? undefined,
          homeCrest: summary.homeCrest,
          awayCrest: summary.awayCrest,
          externalMatchId: summary.id,
          externalSource: "api-football",
          homeTeamId: summary.homeTeamId,
          awayTeamId: summary.awayTeamId,
          competitionId: summary.competitionCode ? Number(summary.competitionCode) : undefined,
          watchIntervals: intervals,
          watchedInPerson,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save match");
      }
      const created = await res.json();
      try {
        sessionStorage.removeItem(`fixture:${externalId}`);
      } catch {
        // best-effort cleanup
      }
      router.push(`/matches/${created.id}`);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save");
      setSaving(false);
    }
  }

  const cardClass = "bg-card rounded-xl p-5 border border-card-border";

  if (loading) {
    return (
      <div className="space-y-6">
        <BackLink />
        <div className="flex items-center gap-3 text-muted py-8">
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading fixture...
        </div>
      </div>
    );
  }

  if (loadError || !summary) {
    return (
      <div className="space-y-6">
        <BackLink />
        <div className={cardClass}>
          <p className="text-red-400">{loadError || "Fixture not found."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <BackLink />

      {/* Header */}
      <div className={cardClass}>
        <div className="text-xs text-muted uppercase tracking-wide mb-2">
          {summary.competition}
          {formatRound(summary.round) ? ` · ${formatRound(summary.round)}` : ""}
        </div>
        <div className="flex items-center gap-4">
          <div className="flex-1 flex items-center gap-3 justify-end min-w-0">
            <span className="text-lg md:text-xl text-white font-semibold truncate text-right">
              {summary.homeTeam}
            </span>
            {summary.homeCrest && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={summary.homeCrest} alt="" className="w-10 h-10 object-contain shrink-0" />
            )}
          </div>
          <div className="text-2xl md:text-3xl font-bold text-white tabular-nums shrink-0 w-20 text-center">
            {summary.homeScore ?? "-"} - {summary.awayScore ?? "-"}
          </div>
          <div className="flex-1 flex items-center gap-3 min-w-0">
            {summary.awayCrest && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={summary.awayCrest} alt="" className="w-10 h-10 object-contain shrink-0" />
            )}
            <span className="text-lg md:text-xl text-white font-semibold truncate">
              {summary.awayTeam}
            </span>
          </div>
        </div>
        <div className="text-xs text-muted mt-3 text-center">
          {new Date(summary.date).toLocaleDateString("en-GB", {
            weekday: "short",
            day: "2-digit",
            month: "short",
            year: "numeric",
          })}
          {summary.venue ? ` · ${summary.venue}` : ""}
        </div>
      </div>

      {/* Confirm card */}
      <div className="bg-card rounded-xl p-5 border-2 border-accent/40">
        <h2 className="text-lg font-semibold text-white mb-1">Did you watch this?</h2>
        <p className="text-sm text-muted mb-4">
          Confirm the minutes you watched, then add it to your feed.
        </p>

        <WatchIntervalEditor intervals={intervals} onChange={setIntervals} />

        <label className="flex items-center gap-2.5 mt-4 text-sm text-slate-200 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={watchedInPerson}
            onChange={(e) => setWatchedInPerson(e.target.checked)}
            className="w-4 h-4 rounded border-card-border bg-surface accent-accent"
          />
          Watched in person at the stadium
          {summary.venue ? (
            <span className="text-muted text-xs">({summary.venue})</span>
          ) : null}
        </label>

        {saveError && (
          <p className="text-sm text-red-400 mt-3">{saveError}</p>
        )}

        <div className="flex items-center gap-3 mt-5">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-accent text-black font-semibold hover:bg-accent/90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? "Saving..." : "Mark as watched"}
          </button>
          <Link
            href="/add"
            className="px-4 py-2 rounded-lg border border-card-border text-slate-200 hover:text-accent hover:border-accent/40 transition-colors"
          >
            Cancel
          </Link>
        </div>
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/add"
      className="text-sm text-muted hover:text-accent transition-colors inline-flex items-center gap-1.5"
    >
      <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
      </svg>
      Back to browse
    </Link>
  );
}
