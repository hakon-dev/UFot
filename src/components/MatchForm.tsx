"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import MatchSearch, { type MatchSearchResult } from "./MatchSearch";

export default function MatchForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
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

  function handleSelect(match: MatchSearchResult) {
    setFormData({
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      homeScore: match.homeScore != null ? String(match.homeScore) : "",
      awayScore: match.awayScore != null ? String(match.awayScore) : "",
      competition: match.competition,
      round: match.round,
      date: match.date,
      venue: match.venue,
      homeCrest: match.homeCrest || "",
      awayCrest: match.awayCrest || "",
    });
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);

    await fetch("/api/matches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    });

    router.push("/");
    router.refresh();
  }

  const inputClass =
    "w-full bg-surface border border-card-border rounded-lg px-4 py-2.5 text-white placeholder-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent";
  const labelClass = "block text-sm font-medium text-slate-300 mb-1";

  return (
    <div className="space-y-6">
      <MatchSearch onSelect={handleSelect} />

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Teams & Score */}
        <div className="bg-card rounded-xl p-6 border border-card-border space-y-4">
          <h2 className="text-lg font-semibold text-white">Teams & Score</h2>
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
        <div className="bg-card rounded-xl p-6 border border-card-border space-y-4">
          <h2 className="text-lg font-semibold text-white">Competition Details</h2>
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
        <div className="bg-card rounded-xl p-6 border border-card-border space-y-4">
          <h2 className="text-lg font-semibold text-white">Date & Venue</h2>
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
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full sm:w-auto bg-accent hover:bg-accent-dim disabled:opacity-40 text-black font-semibold px-8 py-3 rounded-lg transition-colors"
        >
          {submitting ? "Saving..." : "Save Match"}
        </button>
      </form>
    </div>
  );
}
