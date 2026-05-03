"use client";

import { usePagedRows, Pagination } from "@/app/stats/_components/TableUtils";
import WatchedMatchRow, {
  WatchedMatchRowHeader,
  type WatchedMatchRowData,
  type Perspective,
  type WatchedMatchRowExtras,
} from "./WatchedMatchRow";

export interface PagedMatchItem {
  match: WatchedMatchRowData;
  perspective: Perspective;
  extras?: WatchedMatchRowExtras;
}

export default function PagedMatchList({
  items,
  pageSize = 10,
}: {
  items: PagedMatchItem[];
  pageSize?: number | null;
}) {
  const { page, setPage, pageCount, visible } = usePagedRows(items, pageSize);

  // If any row in the full list carries extras, every row reserves the G/A/Y/R
  // columns — so stats line up across the list and across pages.
  const showExtras = items.some((i) => i.extras != null);

  if (items.length === 0) {
    return <p className="text-sm text-muted">No matches yet.</p>;
  }

  return (
    <>
      <div className="[&>*]:border-b [&>*]:border-card-border/50">
        <WatchedMatchRowHeader showExtras={showExtras} />
        {visible.map((item) => (
          <WatchedMatchRow
            key={item.match.matchId}
            match={item.match}
            perspective={item.perspective}
            extras={item.extras}
            showExtras={showExtras}
          />
        ))}
      </div>
      <Pagination page={page} pageCount={pageCount} setPage={setPage} />
    </>
  );
}
