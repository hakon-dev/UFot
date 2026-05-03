import Link from "next/link";
import { getAllMatches, getRefereeAggregates } from "@/lib/db";
import { hydratePendingMatches } from "@/lib/match-hydration";
import { pickDefaultGender } from "@/lib/gender";
import RefereeStatsTable, { type RefereeStat } from "./RefereeStatsTable";
import SectionHeader from "@/components/SectionHeader";

export const dynamic = "force-dynamic";

export default async function RefereesPage() {
  await hydratePendingMatches(5);

  const defaultGender = pickDefaultGender(getAllMatches());
  const aggregates = getRefereeAggregates();
  const rows: RefereeStat[] = aggregates.map((a) => ({
    name: a.name,
    matches: a.matches,
    minutes: a.minutes,
    gender: a.gender,
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
        <h1 className="text-2xl font-bold text-white">Referees</h1>
        <p className="text-sm text-muted mt-1">
          {rows.length} {rows.length === 1 ? "referee" : "referees"} tracked.
        </p>
      </div>

      <div className={cardClass}>
        <SectionHeader title="Most Watched Referees" seeAllHref="/referees/total" />
        <RefereeStatsTable referees={rows} pageSize={10} defaultGender={defaultGender} />
      </div>
    </div>
  );
}
