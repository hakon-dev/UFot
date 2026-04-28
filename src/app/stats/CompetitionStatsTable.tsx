"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  GenderToggle, HeaderButton, Pagination, usePagedRows,
  type GenderFilter, type SortDir,
} from "./_components/TableUtils";

// Keep in sync with REGION_NAMES in src/lib/competition-stats.ts. Duplicated here (rather than
// imported) because competition-stats.ts pulls in db.ts and this is a client component.
const REGION_NAMES = new Set([
  "World",
  "Europe",
  "Africa",
  "Asia",
  "South America",
  "North America",
  "Oceania",
]);

function isRegionName(name: string | null | undefined): boolean {
  return !!name && REGION_NAMES.has(name);
}

function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className} aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a14 14 0 0 1 0 18" />
      <path d="M12 3a14 14 0 0 0 0 18" />
    </svg>
  );
}

export interface CompetitionStat {
  competitionId: number | null;
  competition: string;
  logo: string | null;
  country: string | null;
  countryCode: string | null;
  matches: number;
  minutes: number;
  gender: "men" | "women";
}

type SortKey = "competition" | "country" | "minutes" | "matches";

const NUMERIC_KEYS: SortKey[] = ["minutes", "matches"];

function compare(a: CompetitionStat, b: CompetitionStat, key: SortKey, dir: SortDir): number {
  const mult = dir === "asc" ? 1 : -1;
  if (NUMERIC_KEYS.includes(key)) {
    return ((a[key] as number) - (b[key] as number)) * mult;
  }
  const av = key === "competition" ? a.competition : a.country;
  const bv = key === "competition" ? b.competition : b.country;
  const aEmpty = !av;
  const bEmpty = !bv;
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1;
  if (bEmpty) return -1;
  return av!.localeCompare(bv!) * mult;
}

export default function CompetitionStatsTable({
  competitions,
  pageSize = 10,
  defaultGender = "men",
}: {
  competitions: CompetitionStat[];
  pageSize?: number | null;
  defaultGender?: "men" | "women";
}) {
  const [sortKey, setSortKey] = useState<SortKey>("minutes");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [gender, setGender] = useState<GenderFilter>(defaultGender);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(NUMERIC_KEYS.includes(key) ? "desc" : "asc");
    }
  };

  const sorted = useMemo(() => {
    const byGender =
      gender === "total" ? competitions : competitions.filter((c) => c.gender === gender);
    return [...byGender].sort((a, b) => compare(a, b, sortKey, sortDir));
  }, [competitions, sortKey, sortDir, gender]);

  const { page, setPage, pageCount, visible, startIndex } = usePagedRows(sorted, pageSize);

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <GenderToggle value={gender} onChange={setGender} />
      </div>
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
                <HeaderButton label="Competition" sortKey="competition" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} align="left" />
              </th>
              <th className="text-left pb-3">
                <HeaderButton label="Country" sortKey="country" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} align="left" />
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
            {visible.map((c, i) => {
              const cellInner = (
                <div className="flex items-center gap-2.5 min-w-0">
                  {c.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.logo} alt="" className="w-5 h-5 object-contain shrink-0" />
                  ) : (
                    <div className="w-5 h-5 shrink-0" />
                  )}
                  <span className="truncate">{c.competition}</span>
                </div>
              );
              return (
              <tr key={c.competitionId ?? c.competition} className="border-b border-card-border/50">
                <td className="py-2.5 text-center text-muted tabular-nums">{startIndex + i + 1}</td>
                <td className="py-2.5 text-slate-200 font-medium">
                  {c.competitionId != null ? (
                    <Link href={`/competitions/${c.competitionId}`} className="hover:text-accent transition-colors block max-w-full">
                      {cellInner}
                    </Link>
                  ) : (
                    cellInner
                  )}
                </td>
                <td className="py-2.5 text-slate-300">
                  {c.country ? (
                    isRegionName(c.country) ? (
                      <div className="flex items-center gap-2 min-w-0">
                        {c.countryCode ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={`https://flagcdn.com/${c.countryCode}.svg`}
                            alt={c.country}
                            className="w-5 h-3.5 object-cover rounded-sm ring-1 ring-card-border shrink-0"
                          />
                        ) : (
                          <GlobeIcon className="w-5 h-3.5 text-muted shrink-0" />
                        )}
                        <span className="truncate">{c.country}</span>
                      </div>
                    ) : c.countryCode ? (
                      <Link
                        href={`/countries/${c.countryCode}`}
                        className="flex items-center gap-2 min-w-0 hover:text-accent transition-colors"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`https://flagcdn.com/${c.countryCode}.svg`}
                          alt={c.country}
                          className="w-5 h-3.5 object-cover rounded-sm ring-1 ring-card-border shrink-0"
                        />
                        <span className="truncate">{c.country}</span>
                      </Link>
                    ) : (
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-5 h-3.5 shrink-0" />
                        <span className="truncate">{c.country}</span>
                      </div>
                    )
                  ) : (
                    <span className="text-muted">-</span>
                  )}
                </td>
                <td className="py-2.5 text-center text-accent tabular-nums">{c.minutes.toLocaleString()}</td>
                <td className="py-2.5 text-center text-slate-300 tabular-nums">{c.matches}</td>
              </tr>
              );
            })}
            {visible.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-muted">No competitions yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Pagination page={page} pageCount={pageCount} setPage={setPage} />
    </>
  );
}
