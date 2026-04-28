"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { HeaderButton, Pagination, usePagedRows, type SortDir } from "@/app/stats/_components/TableUtils";

export interface RefereeStat {
  name: string;
  matches: number;
  minutes: number;
}

type SortKey = "name" | "minutes" | "matches";
const NUMERIC_KEYS: SortKey[] = ["minutes", "matches"];

function compare(a: RefereeStat, b: RefereeStat, key: SortKey, dir: SortDir): number {
  const mult = dir === "asc" ? 1 : -1;
  if (key === "minutes") return (a.minutes - b.minutes) * mult;
  if (key === "matches") return (a.matches - b.matches) * mult;
  return a.name.localeCompare(b.name) * mult;
}

export default function RefereeStatsTable({
  referees,
  pageSize = 10,
}: {
  referees: RefereeStat[];
  pageSize?: number | null;
}) {
  const [filter, setFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("minutes");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const handleSort = (key: SortKey) => {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(NUMERIC_KEYS.includes(key) ? "desc" : "asc");
    }
  };

  const processed = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const filtered = q ? referees.filter((r) => r.name.toLowerCase().includes(q)) : referees;
    return [...filtered].sort((a, b) => compare(a, b, sortKey, sortDir));
  }, [referees, filter, sortKey, sortDir]);

  const { page, setPage, pageCount, visible, startIndex } = usePagedRows(processed, pageSize);

  return (
    <>
      <div className="mb-3">
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by name…"
          className="w-full sm:max-w-xs bg-surface border border-card-border rounded-lg px-3 py-1.5 text-sm text-slate-200 placeholder:text-muted focus:outline-none focus:border-accent/50 transition-colors"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm table-fixed">
          <colgroup>
            <col className="w-10" />
            <col />
            <col className="w-28" />
            <col className="w-24" />
          </colgroup>
          <thead>
            <tr className="text-muted border-b border-card-border">
              <th className="text-center pb-3 font-medium">#</th>
              <th className="text-left pb-3">
                <HeaderButton label="Referee" sortKey="name" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} align="left" />
              </th>
              <th className="text-center pb-3">
                <HeaderButton label="Minutes" sortKey="minutes" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} align="center" />
              </th>
              <th className="text-center pb-3">
                <HeaderButton label="Matches" sortKey="matches" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} align="center" />
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r, i) => (
              <tr key={r.name} className="border-b border-card-border/50">
                <td className="py-2.5 text-center text-muted tabular-nums">{startIndex + i + 1}</td>
                <td className="py-2.5 text-slate-200 font-medium">
                  <Link
                    href={`/referees/${encodeURIComponent(r.name)}`}
                    className="hover:text-accent transition-colors block max-w-full truncate"
                  >
                    {r.name}
                  </Link>
                </td>
                <td className="py-2.5 text-center text-accent tabular-nums">{r.minutes.toLocaleString()}</td>
                <td className="py-2.5 text-center text-slate-300 tabular-nums">{r.matches}</td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={4} className="py-6 text-center text-muted">
                  {filter ? `No referees match "${filter}".` : "No referees yet."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Pagination page={page} pageCount={pageCount} setPage={setPage} />
    </>
  );
}
