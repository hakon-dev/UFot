"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { HeaderButton, Pagination, usePagedRows, type SortDir } from "./_components/TableUtils";

interface PlayerStat {
  playerId: number | null;
  name: string;
  minutesWatched: number;
  matches: number;
  goalsWatched: number;
  assistsWatched: number;
  yellowsWatched: number;
  redsWatched: number;
  club: string | null;
  clubId: number | null;
  clubCrest: string | null;
  nationality: string | null;
  countryCode: string | null;
}

type SortKey =
  | "name"
  | "club"
  | "nationality"
  | "minutesWatched"
  | "matches"
  | "goalsWatched"
  | "assistsWatched"
  | "yellowsWatched"
  | "redsWatched";

const NUMERIC_KEYS: SortKey[] = [
  "minutesWatched",
  "matches",
  "goalsWatched",
  "assistsWatched",
  "yellowsWatched",
  "redsWatched",
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function PhotoCell({ playerId, name }: { playerId: number | null; name: string }) {
  const [failed, setFailed] = useState(false);
  if (playerId == null || failed) {
    return (
      <div className="w-7 h-7 rounded-full bg-surface ring-1 ring-card-border flex items-center justify-center shrink-0">
        <span className="text-[9px] font-bold text-muted">{initials(name)}</span>
      </div>
    );
  }
  return (
    <div className="w-7 h-7 rounded-full bg-surface ring-1 ring-card-border overflow-hidden shrink-0">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`https://media.api-sports.io/football/players/${playerId}.png`}
        alt={name}
        className="w-full h-full object-cover"
        onError={() => setFailed(true)}
      />
    </div>
  );
}

function ClubCell({ club, clubId, clubCrest }: { club: string | null; clubId: number | null; clubCrest: string | null }) {
  if (!club) return <span className="text-muted">-</span>;
  const inner = (
    <div className="flex items-center gap-2 min-w-0">
      {clubCrest ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={clubCrest} alt={club} className="w-4 h-4 object-contain shrink-0" />
      ) : (
        <div className="w-4 h-4 shrink-0" />
      )}
      <span className="truncate">{club}</span>
    </div>
  );
  if (clubId != null) {
    return (
      <Link href={`/teams/${clubId}`} className="hover:text-accent transition-colors block max-w-full">
        {inner}
      </Link>
    );
  }
  return inner;
}

function NationalityCell({ nationality, countryCode }: { nationality: string | null; countryCode: string | null }) {
  if (!nationality) return <span className="text-muted">-</span>;
  if (countryCode) {
    return (
      <Link
        href={`/countries/${countryCode}`}
        className="flex items-center gap-2 min-w-0 hover:text-accent transition-colors"
      >
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

function compare(a: PlayerStat, b: PlayerStat, key: SortKey, dir: SortDir): number {
  const mult = dir === "asc" ? 1 : -1;

  if (NUMERIC_KEYS.includes(key)) {
    const av = a[key] as number;
    const bv = b[key] as number;
    return (av - bv) * mult;
  }

  const av =
    key === "name" ? a.name : key === "club" ? a.club : a.nationality;
  const bv =
    key === "name" ? b.name : key === "club" ? b.club : b.nationality;
  const aEmpty = !av;
  const bEmpty = !bv;
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1;
  if (bEmpty) return -1;
  return av!.localeCompare(bv!) * mult;
}

export default function PlayerStatsTable({
  players,
  pageSize = 10,
}: {
  players: PlayerStat[];
  pageSize?: number | null;
}) {
  const [filter, setFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("minutesWatched");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

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
    const filtered = q
      ? players.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            (p.club?.toLowerCase().includes(q) ?? false) ||
            (p.nationality?.toLowerCase().includes(q) ?? false)
        )
      : players;
    return [...filtered].sort((a, b) => compare(a, b, sortKey, sortDir));
  }, [players, filter, sortKey, sortDir]);

  const { page, setPage, pageCount, visible, startIndex } = usePagedRows(processed, pageSize);

  return (
    <>
      <div className="mb-3">
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by name, club, or nationality…"
          className="w-full sm:max-w-xs bg-surface border border-card-border rounded-lg px-3 py-1.5 text-sm text-slate-200 placeholder:text-muted focus:outline-none focus:border-accent/50 transition-colors"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm table-fixed">
          <colgroup>
            <col className="w-10" />
            <col />
            <col className="w-44" />
            <col className="w-44" />
            <col className="w-16" />
            <col className="w-16" />
            <col className="w-14" />
            <col className="w-16" />
            <col className="w-10" />
            <col className="w-10" />
          </colgroup>
          <thead>
            <tr className="text-muted border-b border-card-border">
              <th className="text-center pb-3 font-medium">#</th>
              <th className="text-left pb-3">
                <HeaderButton label="Player" sortKey="name" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} align="left" />
              </th>
              <th className="text-left pb-3">
                <HeaderButton label="Club" sortKey="club" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} align="left" />
              </th>
              <th className="text-left pb-3">
                <HeaderButton label="Nationality" sortKey="nationality" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} align="left" />
              </th>
              <th className="text-center pb-3">
                <HeaderButton label="Minutes" sortKey="minutesWatched" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} align="center" />
              </th>
              <th className="text-center pb-3">
                <HeaderButton label="Matches" sortKey="matches" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} align="center" />
              </th>
              <th className="text-center pb-3">
                <HeaderButton label="Goals" sortKey="goalsWatched" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} align="center" />
              </th>
              <th className="text-center pb-3">
                <HeaderButton label="Assists" sortKey="assistsWatched" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} align="center" />
              </th>
              <th className="text-center pb-3">
                <HeaderButton label="Y" sortKey="yellowsWatched" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} align="center" />
              </th>
              <th className="text-center pb-3">
                <HeaderButton label="R" sortKey="redsWatched" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} align="center" />
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((p, i) => {
              const nameCell = (
                <div className="flex items-center gap-2.5 min-w-0">
                  <PhotoCell playerId={p.playerId} name={p.name} />
                  <span className="truncate">{p.name}</span>
                </div>
              );
              return (
                <tr key={`${p.playerId ?? "n"}-${p.name}-${i}`} className="border-b border-card-border/50">
                  <td className="py-2.5 text-center text-muted tabular-nums">{startIndex + i + 1}</td>
                  <td className="py-2.5 text-slate-200 font-medium">
                    {p.playerId != null ? (
                      <Link
                        href={`/players/${p.playerId}`}
                        className="hover:text-accent transition-colors block max-w-full"
                      >
                        {nameCell}
                      </Link>
                    ) : (
                      nameCell
                    )}
                  </td>
                  <td className="py-2.5 text-slate-300">
                    <ClubCell club={p.club} clubId={p.clubId} clubCrest={p.clubCrest} />
                  </td>
                  <td className="py-2.5 text-slate-300">
                    <NationalityCell nationality={p.nationality} countryCode={p.countryCode} />
                  </td>
                  <td className="py-2.5 text-center text-accent tabular-nums">
                    {p.minutesWatched}′
                  </td>
                  <td className="py-2.5 text-center text-slate-300 tabular-nums">{p.matches}</td>
                  <td className="py-2.5 text-center tabular-nums">
                    <StatValue value={p.goalsWatched} suffix="G" tone="accent" />
                  </td>
                  <td className="py-2.5 text-center tabular-nums">
                    <StatValue value={p.assistsWatched} suffix="A" tone="slate" />
                  </td>
                  <td className="py-2.5 text-center tabular-nums">
                    <StatValue value={p.yellowsWatched} suffix="Y" tone="yellow" />
                  </td>
                  <td className="py-2.5 text-center tabular-nums">
                    <StatValue value={p.redsWatched} suffix="R" tone="red" />
                  </td>
                </tr>
              );
            })}
            {visible.length === 0 && (
              <tr>
                <td colSpan={10} className="py-6 text-center text-muted">
                  {filter ? `No players match "${filter}".` : "No players yet."}
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
