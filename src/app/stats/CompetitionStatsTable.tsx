"use client";

import { useMemo, useState } from "react";

export interface CompetitionStat {
  competition: string;
  matches: number;
  minutes: number;
}

type SortKey = "competition" | "matches" | "minutes";
type SortDir = "asc" | "desc";

const NUMERIC_KEYS: SortKey[] = ["matches", "minutes"];

function SortArrow({ dir }: { dir: SortDir }) {
  return <span className="ml-1 text-[10px] text-accent">{dir === "asc" ? "▲" : "▼"}</span>;
}

function HeaderButton({
  label,
  sortKey,
  currentKey,
  currentDir,
  onSort,
  align,
}: {
  label: string;
  sortKey: SortKey;
  currentKey: SortKey;
  currentDir: SortDir;
  onSort: (key: SortKey) => void;
  align: "left" | "center";
}) {
  const isActive = currentKey === sortKey;
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      className={`inline-flex items-center ${
        align === "center" ? "justify-center" : "justify-start"
      } gap-0.5 font-medium hover:text-accent transition-colors w-full`}
    >
      {label}
      {isActive && <SortArrow dir={currentDir} />}
    </button>
  );
}

function compare(a: CompetitionStat, b: CompetitionStat, key: SortKey, dir: SortDir): number {
  const mult = dir === "asc" ? 1 : -1;
  if (NUMERIC_KEYS.includes(key)) {
    return ((a[key] as number) - (b[key] as number)) * mult;
  }
  return a.competition.localeCompare(b.competition) * mult;
}

export default function CompetitionStatsTable({ competitions }: { competitions: CompetitionStat[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("matches");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(NUMERIC_KEYS.includes(key) ? "desc" : "asc");
    }
  };

  const sorted = useMemo(
    () => [...competitions].sort((a, b) => compare(a, b, sortKey, sortDir)),
    [competitions, sortKey, sortDir]
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-muted border-b border-card-border">
            <th className="text-left pb-3">
              <HeaderButton label="Competition" sortKey="competition" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} align="left" />
            </th>
            <th className="text-center pb-3">
              <HeaderButton label="Matches" sortKey="matches" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} align="center" />
            </th>
            <th className="text-center pb-3">
              <HeaderButton label="Minutes" sortKey="minutes" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} align="center" />
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((c) => (
            <tr key={c.competition} className="border-b border-card-border/50">
              <td className="py-2.5 text-slate-200 font-medium">{c.competition}</td>
              <td className="py-2.5 text-center text-slate-300 tabular-nums">{c.matches}</td>
              <td className="py-2.5 text-center text-accent tabular-nums">{c.minutes.toLocaleString()}</td>
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={3} className="py-6 text-center text-muted">No competitions yet.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
