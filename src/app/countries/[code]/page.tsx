import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getCompetitionsByCountryCode,
  getMatchesWithDetails,
  getTeamsByCountryCode,
} from "@/lib/db";
import { codeToCountryName } from "@/lib/country-codes";
import { computePlayerStats, enrichPlayerStatsWithNationality } from "@/lib/player-stats";
import { enrichTeamRecordsWithCountry } from "@/lib/team-stats";
import { enrichCompetitionRecordsWithDetails } from "@/lib/competition-stats";
import { aggregateCompetitions, aggregateTeams, minutesOf } from "@/lib/stats-aggregation";
import PlayerStatsTable from "@/app/stats/PlayerStatsTable";
import TeamStatsTable from "@/app/stats/TeamStatsTable";
import CompetitionStatsTable from "@/app/stats/CompetitionStatsTable";
import SectionHeader from "@/components/SectionHeader";

export const dynamic = "force-dynamic";

export default async function CountryPage({
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
  const nationalTeamRecords = teamsFromCountry.filter((t) => t.national === 1);

  const competitionsFromCountry = getCompetitionsByCountryCode(code);
  const competitionIds = new Set<number>(competitionsFromCountry.map((c) => c.id));
  const competitionNames = new Set<string>(competitionsFromCountry.map((c) => c.name));

  const allMatches = getMatchesWithDetails();

  // Matches involving any club from this country (national teams excluded — their matches still
  // show under the national-team page, but the "clubs from this country" rollup is club-only).
  const clubMatches = allMatches.filter(
    (m) =>
      (m.home_team_id != null && clubIds.has(m.home_team_id)) ||
      (m.away_team_id != null && clubIds.has(m.away_team_id))
  );

  // Matches in any competition from this country (id-first; legacy rows fall back to name match).
  const competitionMatches = allMatches.filter(
    (m) =>
      (m.competition_id != null && competitionIds.has(m.competition_id)) ||
      (m.competition_id == null && m.competition && competitionNames.has(m.competition))
  );

  // Aggregations
  const teamStats = aggregateTeams(clubMatches).filter(
    (t) => t.teamId != null && clubIds.has(t.teamId)
  );
  await enrichTeamRecordsWithCountry(teamStats);

  const competitionStats = aggregateCompetitions(competitionMatches).filter(
    (c) => c.competitionId != null && competitionIds.has(c.competitionId)
  );
  await enrichCompetitionRecordsWithDetails(competitionStats);

  // Players whose nationality matches this country (regardless of where they play).
  const allPlayers = computePlayerStats(allMatches);
  await enrichPlayerStatsWithNationality(allPlayers);
  const playersFromCountry = allPlayers.filter((p) => p.countryCode === code);

  // Players appearing in matches in this country's competitions (any nationality).
  const playersInCompetitions = await (async () => {
    if (competitionMatches.length === 0) return [];
    const stats = computePlayerStats(competitionMatches);
    await enrichPlayerStatsWithNationality(stats);
    return stats;
  })();

  const totalMinutesClubs = clubMatches.reduce((s, m) => s + minutesOf(m.watch_intervals), 0);
  const totalMinutesComps = competitionMatches.reduce(
    (s, m) => s + minutesOf(m.watch_intervals),
    0
  );

  // National teams from this country that the user has actually watched.
  const watchedNationalTeams = nationalTeamRecords.filter((t) =>
    allMatches.some((m) => m.home_team_id === t.id || m.away_team_id === t.id)
  );

  const cardClass = "bg-card rounded-xl p-5 border border-card-border";
  const sectionClass = "bg-card rounded-xl p-6 border border-card-border";

  const hasAnyContent =
    teamStats.length > 0 ||
    competitionStats.length > 0 ||
    playersFromCountry.length > 0 ||
    playersInCompetitions.length > 0 ||
    watchedNationalTeams.length > 0;

  return (
    <div className="space-y-6">
      <Link
        href="/stats"
        className="text-sm text-muted hover:text-accent transition-colors inline-flex items-center gap-1.5"
      >
        <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
            clipRule="evenodd"
          />
        </svg>
        Back to stats
      </Link>

      <div className={cardClass}>
        <div className="flex items-center gap-4 flex-wrap">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://flagcdn.com/${code}.svg`}
            alt={countryName}
            className="w-16 h-12 object-cover rounded-md ring-1 ring-card-border"
          />
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-white">{countryName}</h1>
            <p className="text-sm text-muted mt-1">
              {clubMatches.length} club match{clubMatches.length === 1 ? "" : "es"} · {totalMinutesClubs.toLocaleString()} min
              {competitionMatches.length > 0 && (
                <>
                  {" "}· {competitionMatches.length} match{competitionMatches.length === 1 ? "" : "es"} in {competitionStats.length} competition{competitionStats.length === 1 ? "" : "s"} ({totalMinutesComps.toLocaleString()} min)
                </>
              )}
            </p>
            {watchedNationalTeams.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {watchedNationalTeams.map((t) => (
                  <Link
                    key={t.id}
                    href={`/teams/${t.id}`}
                    className="px-2.5 py-1 rounded-full bg-surface border border-card-border text-xs text-slate-200 hover:text-accent transition-colors inline-flex items-center gap-1.5"
                  >
                    {t.logo && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={t.logo} alt={t.name} className="w-4 h-4 object-contain" />
                    )}
                    National team: {t.name}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {!hasAnyContent ? (
        <p className="text-muted text-center py-8">
          No watched matches, players, or competitions tied to {countryName} yet.
        </p>
      ) : (
        <>
          {teamStats.length > 0 && (
            <div className={sectionClass}>
              <SectionHeader title={`Clubs from ${countryName}`} seeAllHref={`/countries/${code}/clubs`} />
              <TeamStatsTable teams={teamStats} pageSize={10} />
            </div>
          )}

          {competitionStats.length > 0 && (
            <div className={sectionClass}>
              <SectionHeader title={`Competitions from ${countryName}`} seeAllHref={`/countries/${code}/competitions`} />
              <CompetitionStatsTable competitions={competitionStats} pageSize={10} />
            </div>
          )}

          {playersFromCountry.length > 0 && (
            <div className={sectionClass}>
              <SectionHeader title={`Players from ${countryName}`} seeAllHref={`/countries/${code}/players`} />
              <p className="text-xs text-muted mb-4">
                Players whose nationality is {countryName}, across every match you&apos;ve watched.
              </p>
              <PlayerStatsTable players={playersFromCountry} pageSize={10} />
            </div>
          )}

          {playersInCompetitions.length > 0 && (
            <div className={sectionClass}>
              <SectionHeader title={`Players in ${countryName} competitions`} seeAllHref={`/countries/${code}/players-in-country`} />
              <p className="text-xs text-muted mb-4">
                Anyone you&apos;ve watched playing in a competition based in {countryName}, regardless
                of nationality.
              </p>
              <PlayerStatsTable players={playersInCompetitions} pageSize={10} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
