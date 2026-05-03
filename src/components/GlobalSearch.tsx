"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
// Type-only import: Next.js will tree-shake this away from the client bundle so no server-only
// code (db.ts, football-api.ts) leaks in.
import type { SearchResponse } from "@/app/api/search/route";

interface FlatRow {
  href: string;
  group: "teams" | "players" | "competitions" | "stadiums" | "coaches" | "referees" | "countries";
  label: string;
  sub: string | null;
  subCountryCode: string | null;
  icon: React.ReactNode;
  source: "cache" | "api" | "static";
}

function ResultIcon({ src, alt, isPlayer }: { src: string | null; alt: string; isPlayer?: boolean }) {
  if (!src) {
    return (
      <div className={`w-6 h-6 ${isPlayer ? "rounded-full" : "rounded"} bg-surface flex items-center justify-center text-[10px] text-muted shrink-0`}>
        {alt.slice(0, 2).toUpperCase()}
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      className={`w-6 h-6 shrink-0 ${isPlayer ? "rounded-full object-cover" : "object-contain"}`}
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
      }}
    />
  );
}

function StadiumIcon() {
  return (
    <div className="w-6 h-6 rounded bg-surface flex items-center justify-center shrink-0">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted">
        <path d="M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6" />
      </svg>
    </div>
  );
}

function CountryFlagIcon({ code }: { code: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://flagcdn.com/${code}.svg`}
      alt=""
      className="w-6 h-4 object-cover rounded-sm shrink-0"
    />
  );
}

function RefereeIcon() {
  return (
    <div className="w-6 h-6 rounded-full bg-surface flex items-center justify-center shrink-0">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    </div>
  );
}

export default function GlobalSearch() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Debounced search. Cache lookups are cheap so we trigger at q.length >= 1, but the live API
  // path inside /api/search only fires when q.length >= 3.
  useEffect(() => {
    const trimmed = q.trim();
    if (!trimmed) {
      setResults(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, {
          signal: ctrl.signal,
        });
        if (!res.ok) throw new Error(`search ${res.status}`);
        const data = (await res.json()) as SearchResponse;
        setResults(data);
        setActiveIdx(0);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setResults(null);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      ctrl.abort();
      clearTimeout(t);
    };
  }, [q]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const flat: FlatRow[] = results
    ? [
        ...results.teams.map<FlatRow>((t) => ({
          href: `/teams/${t.id}`,
          group: "teams",
          label: t.name,
          sub: t.country,
          subCountryCode: t.countryCode,
          icon: <ResultIcon src={t.logo} alt={t.name} />,
          source: t.source,
        })),
        ...results.players.map<FlatRow>((p) => ({
          href: `/players/${p.id}`,
          group: "players",
          label: p.name,
          sub: p.nationality,
          subCountryCode: p.countryCode,
          icon: <ResultIcon src={p.photo} alt={p.name} isPlayer />,
          source: p.source,
        })),
        ...results.competitions.map<FlatRow>((c) => ({
          href: `/competitions/${c.id}`,
          group: "competitions",
          label: c.name,
          sub: c.country,
          subCountryCode: c.countryCode,
          icon: <ResultIcon src={c.logo} alt={c.name} />,
          source: c.source,
        })),
        ...results.stadiums.map<FlatRow>((s) => ({
          href: `/stadiums/${s.id}`,
          group: "stadiums",
          label: s.name,
          sub: s.city ?? s.country,
          subCountryCode: null,
          icon: <StadiumIcon />,
          source: s.source,
        })),
        ...results.coaches.map<FlatRow>((c) => ({
          href: `/coaches/${c.id}`,
          group: "coaches",
          label: c.name,
          sub: c.nationality,
          subCountryCode: c.countryCode,
          icon: <ResultIcon src={c.photo} alt={c.name} isPlayer />,
          source: c.source,
        })),
        ...results.referees.map<FlatRow>((r) => ({
          href: `/referees/${r.slug}`,
          group: "referees",
          label: r.name,
          sub: `${r.matches} ${r.matches === 1 ? "match" : "matches"}`,
          subCountryCode: null,
          icon: <RefereeIcon />,
          source: r.source,
        })),
        ...results.countries.map<FlatRow>((c) => ({
          href: `/countries/${c.code}`,
          group: "countries",
          label: c.name,
          sub: null,
          subCountryCode: null,
          icon: <CountryFlagIcon code={c.code} />,
          source: c.source,
        })),
      ]
    : [];

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActiveIdx((i) => Math.min(flat.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      const row = flat[activeIdx];
      if (row) {
        e.preventDefault();
        router.push(row.href);
        setOpen(false);
        setQ("");
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  }

  const showPanel = open && q.trim().length > 0;
  const totalHits = flat.length;
  const groupOrder: FlatRow["group"][] = [
    "teams", "players", "competitions", "countries", "stadiums", "coaches", "referees",
  ];
  const groupLabels: Record<FlatRow["group"], string> = {
    teams: "Teams",
    players: "Players",
    competitions: "Competitions",
    countries: "Countries",
    stadiums: "Stadiums",
    coaches: "Coaches",
    referees: "Referees",
  };

  let runningIdx = 0;

  return (
    <div ref={wrapperRef} className="relative w-full max-w-md">
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
        </span>
        <input
          ref={inputRef}
          type="search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search teams, players, competitions, countries, stadiums, coaches, referees…"
          className="w-full bg-surface border border-card-border rounded-lg pl-9 pr-3 py-2 text-sm placeholder:text-muted focus:outline-none focus:border-accent"
        />
      </div>

      {showPanel && (
        <div className="absolute left-0 right-0 mt-2 bg-card border border-card-border rounded-lg shadow-2xl max-h-[70vh] overflow-y-auto z-50">
          {q.trim().length < 3 && (
            <div className="px-3 py-2 text-xs text-muted border-b border-card-border">
              Type 3+ characters to search the wider football database.
            </div>
          )}
          {loading && totalHits === 0 && (
            <div className="px-3 py-4 text-sm text-muted">Searching…</div>
          )}
          {!loading && totalHits === 0 && q.trim().length >= 3 && (
            <div className="px-3 py-4 text-sm text-muted">No results.</div>
          )}
          {results?.liveError && (
            <div className="px-3 py-2 text-xs text-amber-400 border-b border-card-border">
              Live search failed: {results.liveError}
            </div>
          )}
          {totalHits > 0 &&
            groupOrder.map((g) => {
              const rows = flat.filter((r) => r.group === g);
              if (rows.length === 0) return null;
              return (
                <div key={g} className="py-1">
                  <div className="px-3 pt-2 pb-1 text-[11px] uppercase tracking-wide text-muted">
                    {groupLabels[g]}
                  </div>
                  {rows.map((row) => {
                    const idx = runningIdx++;
                    const active = idx === activeIdx;
                    return (
                      <Link
                        key={`${g}:${row.href}`}
                        href={row.href}
                        onMouseEnter={() => setActiveIdx(idx)}
                        onClick={() => {
                          setOpen(false);
                          setQ("");
                        }}
                        className={`flex items-center gap-3 px-3 py-2 text-sm ${
                          active ? "bg-card-hover" : ""
                        } hover:bg-card-hover`}
                      >
                        {row.icon}
                        <div className="flex-1 min-w-0">
                          <div className="truncate text-foreground">{row.label}</div>
                          {row.sub && (
                            <div className="truncate text-xs text-muted flex items-center gap-1.5">
                              {row.subCountryCode && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={`https://flagcdn.com/${row.subCountryCode}.svg`}
                                  alt=""
                                  className="w-4 h-3 object-cover rounded-sm shrink-0"
                                />
                              )}
                              <span className="truncate">{row.sub}</span>
                            </div>
                          )}
                        </div>
                        {row.source === "api" && (
                          <span
                            title="Loaded from live API"
                            className="text-[10px] uppercase tracking-wide text-muted border border-card-border rounded px-1.5 py-0.5 shrink-0"
                          >
                            new
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
