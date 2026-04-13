"use client";

import { useRouter } from "next/navigation";
import type { Match } from "@/lib/db";

export default function MatchCard({ match }: { match: Match }) {
  const router = useRouter();

  async function handleDelete() {
    if (!confirm("Delete this match?")) return;

    await fetch(`/api/matches/${match.id}`, { method: "DELETE" });
    router.refresh();
  }

  const dateStr = new Date(match.date).toLocaleDateString("en-GB", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 hover:border-slate-600 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          {/* Score line */}
          <div className="flex items-center gap-3 text-lg">
            <span className={`font-semibold ${match.home_score > match.away_score ? "text-emerald-400" : "text-slate-200"}`}>
              {match.home_team}
            </span>
            <span className="text-2xl font-bold text-white tabular-nums">
              {match.home_score} - {match.away_score}
            </span>
            <span className={`font-semibold ${match.away_score > match.home_score ? "text-emerald-400" : "text-slate-200"}`}>
              {match.away_team}
            </span>
          </div>

          {/* Details */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-slate-400">
            <span>{dateStr}</span>
            {match.competition && <span>{match.competition}</span>}
            {match.round && <span>{match.round}</span>}
            {match.venue && <span>{match.venue}</span>}
          </div>
        </div>

        <button
          onClick={handleDelete}
          className="text-slate-500 hover:text-red-400 transition-colors p-1"
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
