import Link from "next/link";
import { notFound } from "next/navigation";
import { getCompetitionsByCountryCode, getMatchesWithDetails } from "@/lib/db";
import { codeToCountryName } from "@/lib/country-codes";
import { enrichCompetitionRecordsWithDetails } from "@/lib/competition-stats";
import { aggregateCompetitions } from "@/lib/stats-aggregation";
import { pickDefaultGender } from "@/lib/gender";
import CompetitionStatsTable from "@/app/stats/CompetitionStatsTable";

export const dynamic = "force-dynamic";

export default async function CountryCompetitionsPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code: rawCode } = await params;
  const code = rawCode.toLowerCase();
  const countryName = codeToCountryName(code);
  if (!countryName) notFound();

  const competitionsFromCountry = getCompetitionsByCountryCode(code);
  const competitionIds = new Set<number>(competitionsFromCountry.map((c) => c.id));
  const competitionNames = new Set<string>(competitionsFromCountry.map((c) => c.name));

  const allMatches = getMatchesWithDetails();
  const competitionMatches = allMatches.filter(
    (m) =>
      (m.competition_id != null && competitionIds.has(m.competition_id)) ||
      (m.competition_id == null && m.competition && competitionNames.has(m.competition))
  );

  const competitionStats = aggregateCompetitions(competitionMatches).filter(
    (c) => c.competitionId != null && competitionIds.has(c.competitionId)
  );
  await enrichCompetitionRecordsWithDetails(competitionStats);

  return (
    <div className="space-y-6">
      <Link href={`/countries/${code}`} className="text-sm text-muted hover:text-accent transition-colors inline-flex items-center gap-1.5">
        <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
        </svg>
        Back to {countryName}
      </Link>

      <h1 className="text-2xl font-bold text-white">Competitions from {countryName}</h1>

      <div className="bg-card rounded-xl p-5 border border-card-border">
        <CompetitionStatsTable competitions={competitionStats} pageSize={null} defaultGender={pickDefaultGender(competitionMatches)} />
      </div>
    </div>
  );
}
