import Link from "next/link";
import { notFound } from "next/navigation";
import { getCompetitionsByCountryCode, getMatchesWithDetails } from "@/lib/db";
import { codeToCountryName } from "@/lib/country-codes";
import { computePlayerStats, enrichPlayerStatsWithNationality } from "@/lib/player-stats";
import PlayerStatsTable from "@/app/stats/PlayerStatsTable";

export const dynamic = "force-dynamic";

export default async function PlayersInCountryCompetitionsPage({
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

  const players = computePlayerStats(competitionMatches);
  await enrichPlayerStatsWithNationality(players);

  return (
    <div className="space-y-6">
      <Link href={`/countries/${code}`} className="text-sm text-muted hover:text-accent transition-colors inline-flex items-center gap-1.5">
        <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
        </svg>
        Back to {countryName}
      </Link>

      <h1 className="text-2xl font-bold text-white">Players in {countryName} competitions</h1>
      <p className="text-sm text-muted">
        Anyone you&apos;ve watched playing in a competition based in {countryName}, regardless of
        nationality.
      </p>

      <div className="bg-card rounded-xl p-5 border border-card-border">
        <PlayerStatsTable players={players} pageSize={null} />
      </div>
    </div>
  );
}
