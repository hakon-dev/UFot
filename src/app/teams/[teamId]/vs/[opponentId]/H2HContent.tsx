"use client";

import { useMemo, useState } from "react";
import PagedMatchList, { type PagedMatchItem } from "@/components/PagedMatchList";
import SectionHeader from "@/components/SectionHeader";

export interface H2HBreakdown {
  matches: number;
  aWins: number;
  draws: number;
  bWins: number;
  aGoals: number;
  bGoals: number;
}

export type H2HVenue = "a-home" | "b-home" | "neutral";

export interface H2HItem extends PagedMatchItem {
  venue: H2HVenue;
}

type View = "total" | H2HVenue;

export default function H2HContent({
  aName,
  bName,
  aHome,
  bHome,
  neutral,
  total,
  items,
}: {
  aName: string;
  bName: string;
  aHome: H2HBreakdown;
  bHome: H2HBreakdown;
  neutral: H2HBreakdown;
  total: H2HBreakdown;
  items: H2HItem[];
}) {
  const [view, setView] = useState<View>("total");

  const segments: { key: View; label: string }[] = [
    { key: "total", label: "All matches" },
    { key: "a-home", label: `${aName} home` },
    { key: "b-home", label: `${bName} home` },
    { key: "neutral", label: "Neutral ground" },
  ];

  const breakdown =
    view === "total" ? total : view === "a-home" ? aHome : view === "b-home" ? bHome : neutral;

  const filteredItems = useMemo(
    () => (view === "total" ? items : items.filter((i) => i.venue === view)),
    [items, view]
  );

  const first = filteredItems[filteredItems.length - 1] ?? null;
  const latest = filteredItems[0] ?? null;

  const cardClass = "bg-card rounded-xl p-5 border border-card-border";

  return (
    <div className="space-y-6">
      <div className="flex justify-center">
        <div className="inline-flex rounded-xl border border-card-border bg-surface p-1 text-sm font-medium flex-wrap justify-center gap-1">
          {segments.map((s) => {
            const active = s.key === view;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => setView(s.key)}
                className={`px-5 py-2 rounded-lg transition-colors ${
                  active
                    ? "bg-accent/20 text-accent"
                    : "text-muted hover:text-white"
                }`}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-card rounded-xl p-5 border border-card-border space-y-4">
        <h2 className="text-lg font-semibold text-white">Record</h2>

        {breakdown.matches === 0 ? (
          <p className="text-sm text-muted text-center py-6">
            No matches in this category yet.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-4">
              <ResultCard label={`${aName} wins`} value={breakdown.aWins} />
              <ResultCard label="Draws" value={breakdown.draws} tone="muted" />
              <ResultCard label={`${bName} wins`} value={breakdown.bWins} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <SubStat label="Matches" value={breakdown.matches} />
              <SubStat label={`${aName} goals`} value={breakdown.aGoals} />
              <SubStat label={`${bName} goals`} value={breakdown.bGoals} />
            </div>
          </>
        )}
      </div>

      {first && latest && (
        <div className="grid grid-cols-2 gap-4">
          <StatCard label="First Meeting" value={formatDate(first.match.date)} />
          <StatCard label="Last Meeting" value={formatDate(latest.match.date)} />
        </div>
      )}

      <div className={cardClass}>
        <SectionHeader title="Matches Watched" />
        <PagedMatchList items={filteredItems} pageSize={10} />
      </div>
    </div>
  );
}

function ResultCard({
  label,
  value,
  tone = "accent",
}: {
  label: string;
  value: number;
  tone?: "accent" | "muted";
}) {
  const valueClass = tone === "accent" ? "text-accent" : "text-slate-200";
  return (
    <div className="bg-surface rounded-lg p-4 border border-card-border text-center">
      <p className="text-xs text-muted truncate">{label}</p>
      <p className={`text-3xl font-bold mt-1 tabular-nums ${valueClass}`}>{value}</p>
    </div>
  );
}

function SubStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-surface rounded-lg p-3 border border-card-border text-center">
      <p className="text-[11px] text-muted truncate">{label}</p>
      <p className="text-xl font-semibold text-slate-100 mt-0.5 tabular-nums">{value}</p>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-card rounded-xl p-4 border border-card-border">
      <p className="text-xs text-muted truncate">{label}</p>
      <p className="text-2xl font-bold text-accent mt-1 tabular-nums">{value}</p>
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
