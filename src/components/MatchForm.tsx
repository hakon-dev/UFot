"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function MatchForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);

    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form));

    await fetch("/api/matches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    router.push("/");
    router.refresh();
  }

  const inputClass =
    "w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2.5 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent";
  const labelClass = "block text-sm font-medium text-slate-300 mb-1";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Teams & Score */}
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 space-y-4">
        <h2 className="text-lg font-semibold text-white">Teams & Score</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="homeTeam" className={labelClass}>Home Team *</label>
            <input id="homeTeam" name="homeTeam" required className={inputClass} placeholder="e.g. Liverpool" />
          </div>
          <div>
            <label htmlFor="awayTeam" className={labelClass}>Away Team *</label>
            <input id="awayTeam" name="awayTeam" required className={inputClass} placeholder="e.g. Arsenal" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 max-w-xs">
          <div>
            <label htmlFor="homeScore" className={labelClass}>Home Score *</label>
            <input id="homeScore" name="homeScore" type="number" min="0" required className={inputClass} placeholder="0" />
          </div>
          <div>
            <label htmlFor="awayScore" className={labelClass}>Away Score *</label>
            <input id="awayScore" name="awayScore" type="number" min="0" required className={inputClass} placeholder="0" />
          </div>
        </div>
      </div>

      {/* Competition Details */}
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 space-y-4">
        <h2 className="text-lg font-semibold text-white">Competition Details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="competition" className={labelClass}>Competition</label>
            <input id="competition" name="competition" className={inputClass} placeholder="e.g. Premier League" />
          </div>
          <div>
            <label htmlFor="round" className={labelClass}>Round / Matchday</label>
            <input id="round" name="round" className={inputClass} placeholder="e.g. Matchday 28" />
          </div>
        </div>
      </div>

      {/* Date & Venue */}
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 space-y-4">
        <h2 className="text-lg font-semibold text-white">Date & Venue</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="date" className={labelClass}>Date *</label>
            <input id="date" name="date" type="date" required className={inputClass} />
          </div>
          <div>
            <label htmlFor="venue" className={labelClass}>Venue</label>
            <input id="venue" name="venue" className={inputClass} placeholder="e.g. Anfield" />
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 disabled:text-emerald-400 text-white font-semibold px-8 py-3 rounded-lg transition-colors"
      >
        {submitting ? "Saving..." : "Save Match"}
      </button>
    </form>
  );
}
