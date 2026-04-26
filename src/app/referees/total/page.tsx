import Link from "next/link";
import { getRefereeAggregates } from "@/lib/db";
import RefereeStatsTable, { type RefereeStat } from "../RefereeStatsTable";

export const dynamic = "force-dynamic";

export default function AllRefereesPage() {
  const aggregates = getRefereeAggregates();
  const rows: RefereeStat[] = aggregates.map((a) => ({
    name: a.name,
    matches: a.matches,
    minutes: a.minutes,
  }));

  return (
    <div className="space-y-6">
      <Link href="/referees" className="text-sm text-muted hover:text-accent transition-colors inline-flex items-center gap-1.5">
        <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
        </svg>
        Back to referees
      </Link>

      <h1 className="text-2xl font-bold text-white">Most Watched Referees</h1>

      <div className="bg-card rounded-xl p-5 border border-card-border">
        <RefereeStatsTable referees={rows} pageSize={null} />
      </div>
    </div>
  );
}
