"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import WatchIntervalEditor from "@/components/WatchIntervalEditor";

export default function MatchForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [watchIntervals, setWatchIntervals] = useState<number[][]>([[0, 90]]);
  const [watchedInPerson, setWatchedInPerson] = useState(false);
  const [hadExtraTime, setHadExtraTime] = useState(false);
  const [hadPenalties, setHadPenalties] = useState(false);
  const [watchedPenalties, setWatchedPenalties] = useState(true);
  const [formData, setFormData] = useState({
    homeTeam: "",
    awayTeam: "",
    homeScore: "",
    awayScore: "",
    competition: "",
    round: "",
    date: "",
    venue: "",
    homeCrest: "",
    awayCrest: "",
  });

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function toggleExtraTime(next: boolean) {
    setHadExtraTime(next);
    if (!next) {
      setHadPenalties(false);
      // Snap a default-shaped [[0,120]] back to [[0,90]]; leave any custom segments alone.
      setWatchIntervals((prev) =>
        prev.length === 1 && prev[0][0] === 0 && prev[0][1] === 120 ? [[0, 90]] : prev
      );
    } else {
      setWatchIntervals((prev) =>
        prev.length === 1 && prev[0][0] === 0 && prev[0][1] === 90 ? [[0, 120]] : prev
      );
    }
  }

  function togglePenalties(next: boolean) {
    setHadPenalties(next);
    if (next) setHadExtraTime(true);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);

    await fetch("/api/matches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...formData,
        watchIntervals,
        watchedInPerson,
        hadExtraTime,
        hadPenalties,
        watchedPenalties: hadPenalties && watchedPenalties,
      }),
    });

    router.push("/");
    router.refresh();
  }

  const inputClass =
    "w-full bg-surface border border-card-border rounded-lg px-4 py-2.5 text-white placeholder-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent";
  const labelClass = "block text-sm font-medium text-slate-300 mb-1";

  return (
    <div className="border border-card-border rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-card-hover transition-colors"
      >
        <span className="text-sm text-muted">
          Can&apos;t find your match? Add manually
        </span>
        <svg
          className={`w-4 h-4 text-muted transition-transform ${open ? "rotate-180" : ""}`}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>

      {open && (
        <form onSubmit={handleSubmit} className="p-6 pt-0 space-y-6">
          {/* Teams & Score */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-white">Teams & Score</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="homeTeam" className={labelClass}>Home Team *</label>
                <input id="homeTeam" name="homeTeam" required className={inputClass} placeholder="e.g. Liverpool" value={formData.homeTeam} onChange={handleChange} />
              </div>
              <div>
                <label htmlFor="awayTeam" className={labelClass}>Away Team *</label>
                <input id="awayTeam" name="awayTeam" required className={inputClass} placeholder="e.g. Arsenal" value={formData.awayTeam} onChange={handleChange} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 max-w-xs">
              <div>
                <label htmlFor="homeScore" className={labelClass}>Home Score *</label>
                <input id="homeScore" name="homeScore" type="number" min="0" required className={inputClass} placeholder="0" value={formData.homeScore} onChange={handleChange} />
              </div>
              <div>
                <label htmlFor="awayScore" className={labelClass}>Away Score *</label>
                <input id="awayScore" name="awayScore" type="number" min="0" required className={inputClass} placeholder="0" value={formData.awayScore} onChange={handleChange} />
              </div>
            </div>
          </div>

          {/* Competition Details */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-white">Competition Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="competition" className={labelClass}>Competition</label>
                <input id="competition" name="competition" className={inputClass} placeholder="e.g. Premier League" value={formData.competition} onChange={handleChange} />
              </div>
              <div>
                <label htmlFor="round" className={labelClass}>Round / Matchday</label>
                <input id="round" name="round" className={inputClass} placeholder="e.g. Matchday 28" value={formData.round} onChange={handleChange} />
              </div>
            </div>
          </div>

          {/* Date & Venue */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-white">Date & Venue</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="date" className={labelClass}>Date *</label>
                <input id="date" name="date" type="date" required className={inputClass} value={formData.date} onChange={handleChange} />
              </div>
              <div>
                <label htmlFor="venue" className={labelClass}>Venue</label>
                <input id="venue" name="venue" className={inputClass} placeholder="e.g. Anfield" value={formData.venue} onChange={handleChange} />
              </div>
            </div>
            <label className="flex items-center gap-2.5 text-sm text-slate-200 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={watchedInPerson}
                onChange={(e) => setWatchedInPerson(e.target.checked)}
                className="w-4 h-4 rounded border-card-border bg-surface accent-accent"
              />
              Watched in person at the stadium
            </label>
          </div>

          {/* Match length */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-white">Match Length</h3>
            <label className="flex items-center gap-2.5 text-sm text-slate-200 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={hadExtraTime}
                onChange={(e) => toggleExtraTime(e.target.checked)}
                className="w-4 h-4 rounded border-card-border bg-surface accent-accent"
              />
              Went to extra time (120 minutes)
            </label>
            <label className="flex items-center gap-2.5 text-sm text-slate-200 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={hadPenalties}
                onChange={(e) => togglePenalties(e.target.checked)}
                className="w-4 h-4 rounded border-card-border bg-surface accent-accent"
              />
              Decided on penalties
            </label>
            {hadPenalties && (
              <label className="flex items-center gap-2.5 text-sm text-slate-200 cursor-pointer select-none ml-6">
                <input
                  type="checkbox"
                  checked={watchedPenalties}
                  onChange={(e) => setWatchedPenalties(e.target.checked)}
                  className="w-4 h-4 rounded border-card-border bg-surface accent-accent"
                />
                Watched the shootout
              </label>
            )}
          </div>

          {/* Watch Intervals */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-white">Watch Intervals</h3>
            <WatchIntervalEditor
              intervals={watchIntervals}
              onChange={setWatchIntervals}
              matchLength={hadExtraTime ? 120 : 90}
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full sm:w-auto bg-accent hover:bg-accent-dim disabled:opacity-40 text-black font-semibold px-8 py-3 rounded-lg transition-colors"
          >
            {submitting ? "Saving..." : "Save Match"}
          </button>
        </form>
      )}
    </div>
  );
}
