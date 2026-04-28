"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { HeaderButton, Pagination, usePagedRows, type SortDir } from "@/app/stats/_components/TableUtils";

export interface CoachStat {
  coachId: number;
  name: string;
  photo: string | null;
  nationality: string | null;
  countryCode: string | null;
  matches: number;
  minutes: number;
  wins: number;
  draws: number;
  losses: number;
}

type SortKey = "name" | "nationality" | "minutes" | "matches" | "wins" | "draws" | "losses";

const NUMERIC_KEYS: SortKey[] = ["minutes", "matches", "wins", "draws", "losses"];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function PhotoCell({ src, name }: { src: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className="w-7 h-7 rounded-full bg-surface ring-1 ring-card-border flex items-center justify-center shrink-0">
        <span className="text-[9px] font-bold text-muted">{initials(name)}</span>
      </div>
    );
  }
  return (
    <div className="w-7 h-7 rounded-full bg-surface ring-1 ring-card-border overflow-hidden shrink-0">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={name} className="w-full h-full object-cover" onError={() => setFailed(true)} />
    </div>
  );
}

function NationalityCell({ nationality, countryCode }: { nationality: string | null; countryCode: string | null }) {
  if (!nationality) return <span className="text-muted">-</span>;
  if (countryCode) {
    return (
      <Link href={`/countries/${countryCode}`} className="flex items-center gap-2 min-w-0 hover:text-accent transition-colors">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`https://flagcdn.com/${countryCode}.svg`}
          alt={nationality}
          className="w-5 h-3.5 object-cover rounded-sm ring-1 ring-card-border shrink-0"
        />
        <span className="truncate">{nationality}</span>
      </Link>
    );
  }
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="w-5 h-3.5 shrink-0" />
      <span className="truncate">{nationality}</span>
    </div>
  );
}

function compare(a: CoachStat, b: CoachStat, key: SortKey, dir: SortDir): number {
  const mult = dir === "asc" ? 1 : -1;
  if (NUMERIC_KEYS.includes(key)) {
    const av = a[key] as number;
    const bv = b[key] as number;
    return (av - bv) * mult;
  }
  const av = key === "name" ? a.name : a.nationality;
  const bv = key === "name" ? b.name : b.nationality;
  const aEmpty = !av;
  const bEmpty = !bv;
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1;
  if (bEmpty) return -1;
  return av!.localeCompare(bv!) * mult;
}

export default function CoachStatsTable({
  coaches,
  pageSize = 10,
}: {
  coaches: CoachStat[];
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
    const filtered = q
      ? coaches.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            (c.nationality?.toLowerCase().includes(q) ?? false)
        )
      : coaches;
    return [...filtered].sort((a, b) => compare(a, b, sortKey, sortDir));
  }, [coaches, filter, sortKey, sortDir]);

  const { page, setPage, pageCount, visible, startIndex } = usePagedRows(processed, pageSize);

  return (
    <>
      <div className="mb-3">
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by name or nationality…"
          className="w-full sm:max-w-xs bg-surface border border-card-border rounded-lg px-3 py-1.5 text-sm text-slate-200 placeholder:text-muted focus:outline-none focus:border-accent/50 transition-colors"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm table-fixed">
          <colgroup>
            <col className="w-10" />
            <col />
            <col className="w-44" />
            <col className="w-24" />
            <col className="w-20" />
            <col className="w-12" />
            <col className="w-12" />
            <col className="w-12" />
          </colgroup>
          <thead>
            <tr className="text-muted border-b border-card-border">
              <th className="text-center pb-3 font-medium">#</th>
              <th className="text-left pb-3">
                <HeaderButton label="Coach" sortKey="name" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} align="left" />
              </th>
              <th className="text-left pb-3">
                <HeaderButton label="Nationality" sortKey="nationality" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} align="left" />
              </th>
              <th className="text-center pb-3">
                <HeaderButton label="Minutes" sortKey="minutes" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} align="center" />
              </th>
              <th className="text-center pb-3">
                <HeaderButton label="Matches" sortKey="matches" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} align="center" />
              </th>
              <th className="text-center pb-3">
                <HeaderButton label="W" sortKey="wins" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} align="center" />
              </th>
              <th className="text-center pb-3">
                <HeaderButton label="D" sortKey="draws" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} align="center" />
              </th>
              <th className="text-center pb-3">
                <HeaderButton label="L" sortKey="losses" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} align="center" />
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((c, i) => (
              <tr key={c.coachId} className="border-b border-card-border/50">
                <td className="py-2.5 text-center text-muted tabular-nums">{startIndex + i + 1}</td>
                <td className="py-2.5 text-slate-200 font-medium">
                  <Link href={`/coaches/${c.coachId}`} className="hover:text-accent transition-colors block max-w-full">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <PhotoCell src={c.photo} name={c.name} />
                      <span className="truncate">{c.name}</span>
                    </div>
                  </Link>
                </td>
                <td className="py-2.5 text-slate-300">
                  <NationalityCell nationality={c.nationality} countryCode={c.countryCode} />
                </td>
                <td className="py-2.5 text-center text-accent tabular-nums">{c.minutes.toLocaleString()}</td>
                <td className="py-2.5 text-center text-slate-300 tabular-nums">{c.matches}</td>
                <td className="py-2.5 text-center text-emerald-400 tabular-nums">{c.wins || <span className="text-muted/50">–</span>}</td>
                <td className="py-2.5 text-center text-slate-300 tabular-nums">{c.draws || <span className="text-muted/50">–</span>}</td>
                <td className="py-2.5 text-center text-red-400 tabular-nums">{c.losses || <span className="text-muted/50">–</span>}</td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={8} className="py-6 text-center text-muted">
                  {filter ? `No coaches match "${filter}".` : "No coaches yet."}
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
