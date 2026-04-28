"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { HeaderButton, Pagination, usePagedRows, type SortDir } from "@/app/stats/_components/TableUtils";

export interface StadiumStat {
  venueId: number;
  venueName: string;
  venueCity: string | null;
  matches: number;
  minutes: number;
}

type SortKey = "stadium" | "city" | "minutes" | "matches";

const NUMERIC_KEYS: SortKey[] = ["minutes", "matches"];

function compare(a: StadiumStat, b: StadiumStat, key: SortKey, dir: SortDir): number {
  const mult = dir === "asc" ? 1 : -1;
  if (key === "minutes") return (a.minutes - b.minutes) * mult;
  if (key === "matches") return (a.matches - b.matches) * mult;
  const av = key === "stadium" ? a.venueName : a.venueCity;
  const bv = key === "stadium" ? b.venueName : b.venueCity;
  const aEmpty = !av;
  const bEmpty = !bv;
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1;
  if (bEmpty) return -1;
  return av!.localeCompare(bv!) * mult;
}

export default function StadiumStatsTable({
  stadiums,
  pageSize = 10,
  matchesLabel = "Matches",
}: {
  stadiums: StadiumStat[];
  pageSize?: number | null;
  matchesLabel?: string;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("minutes");
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
    () => [...stadiums].sort((a, b) => compare(a, b, sortKey, sortDir)),
    [stadiums, sortKey, sortDir]
  );

  const { page, setPage, pageCount, visible, startIndex } = usePagedRows(sorted, pageSize);

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm table-fixed">
          <colgroup>
            <col className="w-10" />
            <col />
            <col className="w-44" />
            <col className="w-28" />
            <col className="w-24" />
          </colgroup>
          <thead>
            <tr className="text-muted border-b border-card-border">
              <th className="text-center pb-3 font-medium">#</th>
              <th className="text-left pb-3">
                <HeaderButton label="Stadium" sortKey="stadium" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} align="left" />
              </th>
              <th className="text-left pb-3">
                <HeaderButton label="City" sortKey="city" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} align="left" />
              </th>
              <th className="text-center pb-3">
                <HeaderButton label="Minutes" sortKey="minutes" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} align="center" />
              </th>
              <th className="text-center pb-3">
                <HeaderButton label={matchesLabel} sortKey="matches" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} align="center" />
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((s, i) => (
              <tr key={s.venueId} className="border-b border-card-border/50">
                <td className="py-2.5 text-center text-muted tabular-nums">{startIndex + i + 1}</td>
                <td className="py-2.5 text-slate-200 font-medium">
                  <Link href={`/stadiums/${s.venueId}`} className="hover:text-accent transition-colors truncate block max-w-full">
                    {s.venueName}
                  </Link>
                </td>
                <td className="py-2.5 text-slate-300">
                  {s.venueCity ? (
                    <span className="block truncate">{s.venueCity}</span>
                  ) : (
                    <span className="text-muted">-</span>
                  )}
                </td>
                <td className="py-2.5 text-center text-accent tabular-nums">{s.minutes.toLocaleString()}</td>
                <td className="py-2.5 text-center text-slate-300 tabular-nums">{s.matches}</td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-muted">No stadiums yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Pagination page={page} pageCount={pageCount} setPage={setPage} />
    </>
  );
}
