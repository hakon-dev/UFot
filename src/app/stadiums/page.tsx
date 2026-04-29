import Link from "next/link";
import { getStadiumAggregates } from "@/lib/db";
import StadiumStatsTable, { type StadiumStat } from "./StadiumStatsTable";
import SectionHeader from "@/components/SectionHeader";

export const dynamic = "force-dynamic";

export default function StadiumsPage() {
  const aggregates = getStadiumAggregates();

  const totalRows: StadiumStat[] = aggregates.map((a) => ({
    venueId: a.venueId,
    venueName: a.venueName,
    venueCity: a.venueCity,
    matches: a.totalMatches,
    minutes: a.totalMinutes,
  }));

  const inPersonRows: StadiumStat[] = aggregates
    .filter((a) => a.inPersonMatches > 0)
    .map((a) => ({
      venueId: a.venueId,
      venueName: a.venueName,
      venueCity: a.venueCity,
      matches: a.inPersonMatches,
      minutes: a.inPersonMinutes,
    }));

  const cardClass = "bg-card rounded-xl p-5 border border-card-border";

  return (
    <div className="space-y-6">
      <Link href="/stats" className="text-sm text-muted hover:text-accent transition-colors inline-flex items-center gap-1.5">
        <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
        </svg>
        Back to stats
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-white">Stadiums</h1>
        <p className="text-sm text-muted mt-1">
          {aggregates.length} {aggregates.length === 1 ? "stadium" : "stadiums"} tracked.
        </p>
      </div>

      <div className={cardClass}>
        <SectionHeader title="Most Watched Stadiums" seeAllHref="/stadiums/total" />
        <StadiumStatsTable stadiums={totalRows} pageSize={10} />
      </div>

      <div className={cardClass}>
        <SectionHeader title="Most Watched Stadiums (In Person)" seeAllHref="/stadiums/in-person" />
        <StadiumStatsTable stadiums={inPersonRows} pageSize={10} matchesLabel="Visits" />
      </div>
    </div>
  );
}
