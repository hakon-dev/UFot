"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { HeaderButton, type SortDir } from "@/app/stats/_components/TableUtils";
import type { PlayerTeamSplit } from "@/lib/player-stats";

type SortKey = "teamName" | "teamRank" | "minutes" | "matches" | "goals" | "assists" | "yellows" | "reds";

const NUMERIC_KEYS: SortKey[] = ["minutes", "matches", "goals", "assists", "yellows", "reds"];

function compare(a: PlayerTeamSplit, b: PlayerTeamSplit, key: SortKey, dir: SortDir): number {
  const mult = dir === "asc" ? 1 : -1;
  if (NUMERIC_KEYS.includes(key)) {
    return ((a[key] as number) - (b[key] as number)) * mult;
  }
  if (key === "teamRank") {
    // Rank ascends = "best first"; missing ranks sink to the bottom regardless of dir.
    const av = a.teamRank ?? Number.POSITIVE_INFINITY;
    const bv = b.teamRank ?? Number.POSITIVE_INFINITY;
    return (av - bv) * mult;
  }
  return a.teamName.localeCompare(b.teamName) * mult;
}

function StatValue({
  value,
  suffix,
  tone,
}: {
  value: number;
  suffix: string;
  tone: "accent" | "slate" | "yellow" | "red";
}) {
  if (!value) return <span className="text-muted/50">–</span>;
  const color =
    tone === "accent"
      ? "text-accent"
      : tone === "yellow"
      ? "text-yellow-400"
      : tone === "red"
      ? "text-red-400"
      : "text-slate-300";
  return (
    <span className={color}>
      {value}
      {suffix}
    </span>
  );
}

export default function PlayerByTeamTable({ rows }: { rows: PlayerTeamSplit[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("minutes");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      // Rank defaults to ascending (#1 first); other numerics descend.
      setSortDir(key === "teamRank" ? "asc" : NUMERIC_KEYS.includes(key) ? "desc" : "asc");
    }
  };

  const sorted = useMemo(
    () => [...rows].sort((a, b) => compare(a, b, sortKey, sortDir)),
    [rows, sortKey, sortDir]
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm table-fixed">
        <colgroup>
          <col className="w-10" />
          <col />
          <col className="w-24" />
          <col className="w-24" />
          <col className="w-24" />
          <col className="w-16" />
          <col className="w-16" />
          <col className="w-12" />
          <col className="w-12" />
        </colgroup>
        <thead>
          <tr className="text-muted border-b border-card-border">
            <th className="text-center pb-3 font-medium">#</th>
            <th className="text-left pb-3">
              <HeaderButton label="Team" sortKey="teamName" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} align="left" />
            </th>
            <th className="text-center pb-3">
              <HeaderButton label="Team rank" sortKey="teamRank" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} align="center" />
            </th>
            <th className="text-center pb-3">
              <HeaderButton label="Minutes" sortKey="minutes" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} align="center" />
            </th>
            <th className="text-center pb-3">
              <HeaderButton label="Matches" sortKey="matches" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} align="center" />
            </th>
            <th className="text-center pb-3">
              <HeaderButton label="Goals" sortKey="goals" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} align="center" />
            </th>
            <th className="text-center pb-3">
              <HeaderButton label="Assists" sortKey="assists" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} align="center" />
            </th>
            <th className="text-center pb-3">
              <HeaderButton label="Y" sortKey="yellows" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} align="center" />
            </th>
            <th className="text-center pb-3">
              <HeaderButton label="R" sortKey="reds" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} align="center" />
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r, i) => {
            const cellInner = (
              <div className="flex items-center gap-2.5 min-w-0">
                {r.teamCrest ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.teamCrest} alt={r.teamName} className="w-5 h-5 object-contain shrink-0" />
                ) : (
                  <svg className="w-5 h-5 text-muted/40 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2L3 7v5c0 5.25 3.83 10.15 9 11.25C17.17 22.15 21 17.25 21 12V7l-9-5zm0 2.18l7 3.89v4.93c0 4.29-3.08 8.28-7 9.18-3.92-.9-7-4.89-7-9.18V8.07l7-3.89z" />
                  </svg>
                )}
                <span className="truncate">{r.teamName}</span>
              </div>
            );
            return (
              <tr key={`${r.teamId ?? r.teamName}-${i}`} className="border-b border-card-border/50">
                <td className="py-2.5 text-center text-muted tabular-nums">{i + 1}</td>
                <td className="py-2.5 text-slate-200 font-medium">
                  {r.teamId != null ? (
                    <Link href={`/teams/${r.teamId}`} className="hover:text-accent transition-colors block max-w-full">
                      {cellInner}
                    </Link>
                  ) : (
                    cellInner
                  )}
                </td>
                <td className="py-2.5 text-center tabular-nums">
                  {r.teamRank != null ? (
                    r.teamId != null ? (
                      <Link
                        href={`/teams/${r.teamId}/players`}
                        className="text-slate-200 hover:text-accent transition-colors"
                      >
                        #{r.teamRank}
                      </Link>
                    ) : (
                      <span className="text-slate-200">#{r.teamRank}</span>
                    )
                  ) : (
                    <span className="text-muted/50">–</span>
                  )}
                </td>
                <td className="py-2.5 text-center text-accent tabular-nums">{r.minutes}′</td>
                <td className="py-2.5 text-center text-slate-300 tabular-nums">{r.matches}</td>
                <td className="py-2.5 text-center tabular-nums">
                  <StatValue value={r.goals} suffix="G" tone="accent" />
                </td>
                <td className="py-2.5 text-center tabular-nums">
                  <StatValue value={r.assists} suffix="A" tone="slate" />
                </td>
                <td className="py-2.5 text-center tabular-nums">
                  <StatValue value={r.yellows} suffix="Y" tone="yellow" />
                </td>
                <td className="py-2.5 text-center tabular-nums">
                  <StatValue value={r.reds} suffix="R" tone="red" />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
