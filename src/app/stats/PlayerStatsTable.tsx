"use client";

import { useState } from "react";

interface PlayerStat {
  name: string;
  minutesWatched: number;
  matches: number;
  goalsWatched: number;
  assistsWatched: number;
}

export default function PlayerStatsTable({ players }: { players: PlayerStat[] }) {
  const [showAll, setShowAll] = useState(false);
  const displayed = showAll ? players : players.slice(0, 20);

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted border-b border-card-border">
              <th className="text-left pb-3 font-medium">Player</th>
              <th className="text-center pb-3 font-medium">Minutes</th>
              <th className="text-center pb-3 font-medium">Matches</th>
              <th className="text-center pb-3 font-medium">Goals</th>
              <th className="text-center pb-3 font-medium">Assists</th>
            </tr>
          </thead>
          <tbody>
            {displayed.map((p) => (
              <tr key={p.name} className="border-b border-card-border/50">
                <td className="py-2.5 text-slate-200 font-medium">{p.name}</td>
                <td className="py-2.5 text-center text-slate-300 tabular-nums">{p.minutesWatched}</td>
                <td className="py-2.5 text-center text-muted tabular-nums">{p.matches}</td>
                <td className="py-2.5 text-center text-accent tabular-nums">{p.goalsWatched || "-"}</td>
                <td className="py-2.5 text-center text-muted tabular-nums">{p.assistsWatched || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {players.length > 20 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="text-xs text-muted hover:text-accent transition-colors mt-3"
        >
          {showAll ? "Show top 20" : `Show all ${players.length} players`}
        </button>
      )}
    </>
  );
}
