"use client";

import type { Match } from "@/lib/db";
import MatchCard from "./MatchCard";
import { usePagedRows, Pagination } from "@/app/stats/_components/TableUtils";

export default function HomeMatchFeed({
  matches,
  pageSize = 10,
}: {
  matches: Match[];
  pageSize?: number | null;
}) {
  const { page, setPage, pageCount, visible } = usePagedRows(matches, pageSize);

  return (
    <>
      <div className="space-y-3">
        {visible.map((match) => (
          <MatchCard key={match.id} match={match} />
        ))}
      </div>
      <Pagination page={page} pageCount={pageCount} setPage={setPage} />
    </>
  );
}
