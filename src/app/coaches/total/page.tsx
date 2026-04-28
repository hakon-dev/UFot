import Link from "next/link";
import { getAllMatches, getCoachAggregates, getCoaches } from "@/lib/db";
import { enrichCoachAggregatesWithNationality } from "@/lib/coach-stats";
import { pickDefaultGender } from "@/lib/gender";
import CoachStatsTable, { type CoachStat } from "../CoachStatsTable";

export const dynamic = "force-dynamic";

export default async function AllCoachesPage() {
  const defaultGender = pickDefaultGender(getAllMatches());
  const aggregates = getCoachAggregates();
  await enrichCoachAggregatesWithNationality(aggregates);

  const cachedById = getCoaches(aggregates.map((a) => a.coachId));
  const rows: CoachStat[] = aggregates.map((a) => {
    const cache = cachedById.get(a.coachId);
    return {
      coachId: a.coachId,
      name: cache?.name ?? a.name,
      photo: a.photo ?? cache?.photo ?? null,
      nationality: cache?.nationality ?? null,
      countryCode: cache?.country_code ?? null,
      matches: a.matches,
      minutes: a.minutes,
      wins: a.wins,
      draws: a.draws,
      losses: a.losses,
      gender: a.gender,
    };
  });

  return (
    <div className="space-y-6">
      <Link href="/coaches" className="text-sm text-muted hover:text-accent transition-colors inline-flex items-center gap-1.5">
        <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
        </svg>
        Back to coaches
      </Link>

      <h1 className="text-2xl font-bold text-white">Most Watched Coaches</h1>

      <div className="bg-card rounded-xl p-5 border border-card-border">
        <CoachStatsTable coaches={rows} pageSize={null} defaultGender={defaultGender} />
      </div>
    </div>
  );
}
