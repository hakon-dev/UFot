import Link from "next/link";
import { getStadiumAggregates } from "@/lib/db";
import StadiumStatsTable, { type StadiumStat } from "../StadiumStatsTable";

export const dynamic = "force-dynamic";

export default function AllStadiumsTotalPage() {
  const aggregates = getStadiumAggregates();
  const rows: StadiumStat[] = aggregates.map((a) => ({
    venueId: a.venueId,
    venueName: a.venueName,
    venueCity: a.venueCity,
    matches: a.totalMatches,
    minutes: a.totalMinutes,
  }));

  return (
    <div className="space-y-6">
      <Link href="/stadiums" className="text-sm text-muted hover:text-accent transition-colors inline-flex items-center gap-1.5">
        <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
        </svg>
        Back to stadiums
      </Link>

      <h1 className="text-2xl font-bold text-white">Most Watched Stadiums</h1>

      <div className="bg-card rounded-xl p-5 border border-card-border">
        <StadiumStatsTable stadiums={rows} pageSize={null} />
      </div>
    </div>
  );
}
