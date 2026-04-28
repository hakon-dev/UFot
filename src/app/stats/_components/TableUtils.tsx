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
