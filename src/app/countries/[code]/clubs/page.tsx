import Link from "next/link";
import { notFound } from "next/navigation";
import { getMatchesWithDetails, getTeamsByCountryCode } from "@/lib/db";
import { codeToCountryName } from "@/lib/country-codes";
import { enrichTeamRecordsWithCountry } from "@/lib/team-stats";
import { aggregateTeams } from "@/lib/stats-aggregation";
import { pickDefaultGender } from "@/lib/gender";
import TeamStatsTable from "@/app/stats/TeamStatsTable";

export const dynamic = "force-dynamic";

export default async function CountryClubsPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code: rawCode } = await params;
  const code = rawCode.toLowerCase();
  const countryName = codeToCountryName(code);
  if (!countryName) notFound();

  const teamsFromCountry = getTeamsByCountryCode(code);
  const clubIds = new Set<number>(
    teamsFromCountry.filter((t) => t.national !== 1).map((t) => t.id)
  );

  const allMatches = getMatchesWithDetails();
  const clubMatches = allMatches.filter(
    (m) =>
      (m.home_team_id != null && clubIds.has(m.home_team_id)) ||
      (m.away_team_id != null && clubIds.has(m.away_team_id))
  );

  const teamStats = aggregateTeams(clubMatches).filter(
    (t) => t.teamId != null && clubIds.has(t.teamId)
  );
  await enrichTeamRecordsWithCountry(teamStats);

  return (
    <div className="space-y-6">
      <Link href={`/countries/${code}`} className="text-sm text-muted hover:text-accent transition-colors inline-flex items-center gap-1.5">
        <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
        </svg>
        Back to {countryName}
      </Link>

      <h1 className="text-2xl font-bold text-white">Clubs from {countryName}</h1>

      <div className="bg-card rounded-xl p-5 border border-card-border">
        <TeamStatsTable teams={teamStats} pageSize={null} defaultGender={pickDefaultGender(clubMatches)} />
      </div>
    </div>
  );
}
