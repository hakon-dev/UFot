import Link from "next/link";
import { getAllMatches } from "@/lib/db";
import { hydratePendingMatches } from "@/lib/match-hydration";
import { enrichCompetitionRecordsWithDetails } from "@/lib/competition-stats";
import { aggregateCompetitions } from "@/lib/stats-aggregation";
import CompetitionStatsTable from "../CompetitionStatsTable";

export const dynamic = "force-dynamic";

export default async function AllCompetitionsStatsPage() {
  await hydratePendingMatches(5);

  const matches = getAllMatches();
  const competitions = aggregateCompetitions(matches);
  await enrichCompetitionRecordsWithDetails(competitions);

  return (
    <div>
      <Link
        href="/stats"
        className="text-sm text-muted hover:text-accent transition-colors inline-flex items-center gap-1.5 mb-4"
      >
        <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
        </svg>
        Back to Stats
      </Link>
      <h1 className="text-2xl font-bold text-white mb-6">All Competitions Watched</h1>
      <div className="bg-card rounded-xl p-6 border border-card-border">
        {competitions.length === 0 ? (
          <p className="text-muted text-center py-8">No competitions yet.</p>
        ) : (
          <CompetitionStatsTable competitions={competitions} pageSize={null} />
        )}
      </div>
    </div>
  );
}
