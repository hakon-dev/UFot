"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  GenderToggle, HeaderButton, Pagination, TeamTypeToggle, usePagedRows,
  type GenderFilter, type SortDir, type TeamTypeFilter,
} from "./_components/TableUtils";

export interface TeamStat {
  team: string;
  teamId: number | null;
  crest: string | null;
  country: string | null;
  countryCode: string | null;
  national: boolean | null;
  matches: number;
  minutes: number;
  goalsFor: number;
  goalsAgainst: number;
  gender: "men" | "women";
}

type SortKey = "team" | "country" | "minutes" | "matches" | "goalsFor" | "goalsAgainst";

const NUMERIC_KEYS: SortKey[] = ["matches", "minutes", "goalsFor", "goalsAgainst"];

function compare(a: TeamStat, b: TeamStat, key: SortKey, dir: SortDir): number {
  const mult = dir === "asc" ? 1 : -1;
  if (NUMERIC_KEYS.includes(key)) {
    return ((a[key] as number) - (b[key] as number)) * mult;
  }
  const av = key === "team" ? a.team : a.country;
  const bv = key === "team" ? b.team : b.country;
  const aEmpty = !av;
  const bEmpty = !bv;
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1;
  if (bEmpty) return -1;
  return av!.localeCompare(bv!) * mult;
}

export default function TeamStatsTable({
  teams,
  pageSize = 10,
  defaultGender = "men",
  showTypeToggle = false,
  showGenderToggle = true,
}: {
  teams: TeamStat[];
  pageSize?: number | null;
  defaultGender?: "men" | "women";
  showTypeToggle?: boolean;
  showGenderToggle?: boolean;
}) {
  const [filter, setFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("minutes");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [gender, setGender] = useState<GenderFilter>(defaultGender);
  const [teamType, setTeamType] = useState<TeamTypeFilter>("total");

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(NUMERIC_KEYS.includes(key) ? "desc" : "asc");
    }
  };

  const processed = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const byGender =
      !showGenderToggle || gender === "total"
        ? teams
        : teams.filter((t) => t.gender === gender);
    const byType =
      !showTypeToggle || teamType === "total"
        ? byGender
        : teamType === "national"
        ? byGender.filter((t) => t.national === true)
        : byGender.filter((t) => t.national !== true);
    const filtered = q
      ? byType.filter(
          (t) =>
            t.team.toLowerCase().includes(q) ||
            (t.country?.toLowerCase().includes(q) ?? false)
        )
      : byType;
    return [...filtered].sort((a, b) => compare(a, b, sortKey, sortDir));
  }, [teams, filter, sortKey, sortDir, gender, teamType, showTypeToggle, showGenderToggle]);

  const { page, setPage, pageCount, visible, startIndex } = usePagedRows(processed, pageSize);

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by team or country…"
          className="w-full sm:max-w-xs bg-surface border border-card-border rounded-lg px-3 py-1.5 text-sm text-slate-200 placeholder:text-muted focus:outline-none focus:border-accent/50 transition-colors"
        />
        {showGenderToggle && <GenderToggle value={gender} onChange={setGender} />}
        {showTypeToggle && <TeamTypeToggle value={teamType} onChange={setTeamType} />}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm table-fixed">
          <colgroup>
            <col className="w-10" />
            <col />
            <col className="w-44" />
            <col className="w-24" />
            <col className="w-24" />
            <col className="w-16" />
            <col className="w-16" />
          </colgroup>
          <thead>
            <tr className="text-muted border-b border-card-border">
              <th className="text-center pb-3 font-medium">#</th>
              <th className="text-left pb-3">
                <HeaderButton label="Team" sortKey="team" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} align="left" />
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
              <th className="text-center pb-3">
                <HeaderButton label="GF" sortKey="goalsFor" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} align="center" />
              </th>
              <th className="text-center pb-3">
                <HeaderButton label="GA" sortKey="goalsAgainst" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} align="center" />
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((t, i) => {
              const cellInner = (
                <div className="flex items-center gap-2.5 min-w-0">
                  {t.crest ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={t.crest} alt={t.team} className="w-5 h-5 object-contain shrink-0" />
                  ) : (
                    <svg className="w-5 h-5 text-muted/40 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2L3 7v5c0 5.25 3.83 10.15 9 11.25C17.17 22.15 21 17.25 21 12V7l-9-5zm0 2.18l7 3.89v4.93c0 4.29-3.08 8.28-7 9.18-3.92-.9-7-4.89-7-9.18V8.07l7-3.89z" />
                    </svg>
                  )}
                  <span className="truncate">{t.team}</span>
                </div>
              );
              return (
                <tr key={t.teamId ?? t.team} className="border-b border-card-border/50">
                  <td className="py-2.5 text-center text-muted tabular-nums">{startIndex + i + 1}</td>
                  <td className="py-2.5 text-slate-200 font-medium">
                    {t.teamId != null ? (
                      <Link href={`/teams/${t.teamId}`} className="hover:text-accent transition-colors block max-w-full">
                        {cellInner}
                      </Link>
                    ) : (
                      cellInner
                    )}
                  </td>
                  <td className="py-2.5 text-slate-300">
                    {t.country ? (
                      t.countryCode ? (
                        <Link
                          href={`/countries/${t.countryCode}`}
                          className="flex items-center gap-2 min-w-0 hover:text-accent transition-colors"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={`https://flagcdn.com/${t.countryCode}.svg`}
                            alt={t.country}
                            className="w-5 h-3.5 object-cover rounded-sm ring-1 ring-card-border shrink-0"
                          />
                          <span className="truncate">{t.country}</span>
                        </Link>
                      ) : (
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-5 h-3.5 shrink-0" />
                          <span className="truncate">{t.country}</span>
                        </div>
                      )
                    ) : (
                      <span className="text-muted">-</span>
                    )}
                  </td>
                  <td className="py-2.5 text-center text-accent tabular-nums">{t.minutes.toLocaleString()}</td>
                  <td className="py-2.5 text-center text-slate-300 tabular-nums">{t.matches}</td>
                  <td className="py-2.5 text-center text-slate-300 tabular-nums">{t.goalsFor}</td>
                  <td className="py-2.5 text-center text-muted tabular-nums">{t.goalsAgainst}</td>
                </tr>
              );
            })}
            {visible.length === 0 && (
              <tr>
                <td colSpan={7} className="py-6 text-center text-muted">
                  {filter ? `No teams match "${filter}".` : "No teams in this view."}
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
