"use client";

import { useMemo, useState } from "react";

export type SortDir = "asc" | "desc";

export function SortArrow({ dir }: { dir: SortDir }) {
  return <span className="ml-1 text-[10px] text-accent">{dir === "asc" ? "▲" : "▼"}</span>;
}

export function HeaderButton<K extends string>({
  label,
  sortKey,
  currentKey,
  currentDir,
  onSort,
  align,
}: {
  label: string;
  sortKey: K;
  currentKey: K;
  currentDir: SortDir;
  onSort: (key: K) => void;
  align: "left" | "center";
}) {
  const isActive = currentKey === sortKey;
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      className={`inline-flex items-center ${
        align === "center" ? "justify-center" : "justify-start"
      } gap-0.5 font-medium hover:text-accent transition-colors w-full whitespace-nowrap`}
    >
      {label}
      {isActive && <SortArrow dir={currentDir} />}
    </button>
  );
}

// Reset the page when the underlying sorted/filtered set changes size (e.g. user typed
// in the filter box), so we don't land on an out-of-range empty page.
export function usePagedRows<T>(
  rows: T[],
  pageSize: number | null
): {
  page: number;
  setPage: (p: number) => void;
  pageCount: number;
  visible: T[];
  startIndex: number;
} {
  const [rawPage, setPage] = useState(1);

  const total = rows.length;
  const pageCount = pageSize == null ? 1 : Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, rawPage), pageCount);
  const startIndex = pageSize == null ? 0 : (page - 1) * pageSize;

  const visible = useMemo(() => {
    if (pageSize == null) return rows;
    return rows.slice(startIndex, startIndex + pageSize);
  }, [rows, startIndex, pageSize]);

  return { page, setPage, pageCount, visible, startIndex };
}

export type GenderFilter = "men" | "women" | "total";

// Three-segment toggle used above every stats table to swap between men's, women's, and the
// combined total. Filtering happens in the parent component — this is just the visual chip.
export function GenderToggle({
  value,
  onChange,
}: {
  value: GenderFilter;
  onChange: (next: GenderFilter) => void;
}) {
  const segments: { key: GenderFilter; label: string }[] = [
    { key: "men", label: "Men" },
    { key: "women", label: "Women" },
    { key: "total", label: "Total" },
  ];
  return <SegmentedToggle segments={segments} value={value} onChange={onChange} />;
}

export type TeamTypeFilter = "club" | "national" | "total";

// Three-segment toggle for the merged Teams table — Club / National / Total.
export function TeamTypeToggle({
  value,
  onChange,
}: {
  value: TeamTypeFilter;
  onChange: (next: TeamTypeFilter) => void;
}) {
  const segments: { key: TeamTypeFilter; label: string }[] = [
    { key: "club", label: "Club" },
    { key: "national", label: "National" },
    { key: "total", label: "Total" },
  ];
  return <SegmentedToggle segments={segments} value={value} onChange={onChange} />;
}

function SegmentedToggle<T extends string>({
  segments,
  value,
  onChange,
}: {
  segments: { key: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-card-border bg-surface p-0.5 text-xs">
      {segments.map((s) => {
        const active = s.key === value;
        return (
          <button
            key={s.key}
            type="button"
            onClick={() => onChange(s.key)}
            className={`px-2.5 py-1 rounded-md transition-colors ${
              active
                ? "bg-accent text-black font-semibold"
                : "text-slate-300 hover:text-accent"
            }`}
            aria-pressed={active}
          >
            {s.label}
          </button>
        );
      })}
    </div>
  );
}

export function Pagination({
  page,
  pageCount,
  setPage,
}: {
  page: number;
  pageCount: number;
  setPage: (p: number) => void;
}) {
  if (pageCount <= 1) return null;
  const btn =
    "px-2.5 py-1 rounded border border-card-border text-slate-300 hover:text-accent hover:border-accent/40 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-slate-300 disabled:hover:border-card-border";
  return (
    <div className="flex items-center justify-end gap-3 mt-3 text-xs">
      <button
        type="button"
        onClick={() => setPage(Math.max(1, page - 1))}
        disabled={page <= 1}
        className={btn}
      >
        ‹ Prev
      </button>
      <span className="text-muted tabular-nums">
        Page {page} of {pageCount}
      </span>
      <button
        type="button"
        onClick={() => setPage(Math.min(pageCount, page + 1))}
        disabled={page >= pageCount}
        className={btn}
      >
        Next ›
      </button>
    </div>
  );
}
