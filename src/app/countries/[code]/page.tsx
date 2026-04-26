import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getCompetitionsByCountryCode,
  getMatchesWithDetails,
  getTeamsByCountryCode,
} from "@/lib/db";
import { codeToCountryName } from "@/lib/country-codes";
import { computePlayerStats, enrichPlayerStatsWithNationality, enrichPlayerStatsWithClub } from "@/lib/player-stats";
import { classifyNationalTeam, enrichTeamRecordsWithCountry } from "@/lib/team-stats";
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
  await enrichPlayerStatsWithClub(allPlayers);
  const playersFromCountry = allPlayers.filter((p) => p.countryCode === code);

  // Players appearing in matches in this country's competitions (any nationality).
  const playersInCompetitions = await (async () => {
    if (competitionMatches.length === 0) return [];
    const stats = computePlayerStats(competitionMatches);
    await enrichPlayerStatsWithNationality(stats);
    await enrichPlayerStatsWithClub(stats);
    return stats;
  })();

  const totalMinutesClubs = clubMatches.reduce((s, m) => s + minutesOf(m.watch_intervals), 0);
  const totalMinutesComps = competitionMatches.reduce(
    (s, m) => s + minutesOf(m.watch_intervals),
    0
  );

  // National teams from this country, classified by gender + age group. API-Football names
  // women's teams with a trailing " W" (e.g. "Norway W", "Norway U-21 W") and youth teams with
  // "U-NN" (e.g. "Norway U-21"). The senior team has no age token. Men/women split into two
  // columns; senior at top, then youth descending by age.
  const classified = nationalTeamRecords.map((t) => {
    const cls = classifyNationalTeam(t.name);
    const watched = allMatches.some((m) => m.home_team_id === t.id || m.away_team_id === t.id);
    return { ...t, gender: cls.gender, age: cls.age, watched };
  });
  // Senior (age=null) ranks ahead of any youth team; among youth, descending age.
  function ageRank(a: { age: number | null }, b: { age: number | null }): number {
    if (a.age === null && b.age === null) return 0;
    if (a.age === null) return -1;
    if (b.age === null) return 1;
    return b.age - a.age;
  }
  const menTeams = classified.filter((t) => t.gender === "men").sort(ageRank);
  const womenTeams = classified.filter((t) => t.gender === "women").sort(ageRank);
  const hasNationalTeams = menTeams.length > 0 || womenTeams.length > 0;

  const cardClass = "bg-card rounded-xl p-5 border border-card-border";
  const sectionClass = "bg-card rounded-xl p-6 border border-card-border";

  const hasAnyContent =
    teamStats.length > 0 ||
    competitionStats.length > 0 ||
    playersFromCountry.length > 0 ||
    playersInCompetitions.length > 0 ||
    hasNationalTeams;

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

      <div className={`${cardClass} border-sky-400/30`}>
        <div className="flex items-center gap-4 flex-wrap">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://flagcdn.com/${code}.svg`}
            alt={countryName}
            className="w-16 h-12 object-cover rounded-md ring-1 ring-card-border"
          />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] uppercase tracking-[0.18em] font-semibold text-sky-300 mb-1">
              Country
            </p>
            <h1 className="text-2xl font-bold text-white">{countryName}</h1>
            <p className="text-sm text-muted mt-1">
              {clubMatches.length} club match{clubMatches.length === 1 ? "" : "es"} · {totalMinutesClubs.toLocaleString()} min
              {competitionMatches.length > 0 && (
                <>
                  {" "}· {competitionMatches.length} match{competitionMatches.length === 1 ? "" : "es"} in {competitionStats.length} competition{competitionStats.length === 1 ? "" : "s"} ({totalMinutesComps.toLocaleString()} min)
                </>
              )}
            </p>
          </div>
        </div>
      </div>

      {!hasAnyContent ? (
        <p className="text-muted text-center py-8">
          No watched matches, players, or competitions tied to {countryName} yet.
        </p>
      ) : (
        <>
          {hasNationalTeams && (
            <div className={sectionClass}>
              <SectionHeader title="National teams" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <NationalTeamColumn title="Men" teams={menTeams} />
                <NationalTeamColumn title="Women" teams={womenTeams} />
              </div>
            </div>
          )}

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

interface NationalTeamRow {
  id: number;
  name: string;
  logo: string | null;
  age: number | null;
  watched: boolean;
}

function NationalTeamColumn({ title, teams }: { title: string; teams: NationalTeamRow[] }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-white mb-3">{title}</h3>
      {teams.length === 0 ? (
        <p className="text-xs text-muted">No {title.toLowerCase()} teams in cache yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {teams.map((t) => (
            <Link
              key={t.id}
              href={`/teams/${t.id}`}
              className="px-3 py-2 rounded-lg bg-surface border border-card-border text-sm text-slate-200 hover:text-accent transition-colors flex items-center gap-3"
            >
              {t.logo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={t.logo} alt={t.name} className="w-6 h-6 object-contain shrink-0" />
              )}
              <span className="flex-1 truncate">{t.name}</span>
              <span className="text-xs text-muted shrink-0">
                {t.age === null ? "Senior" : `U-${t.age}`}
              </span>
              {!t.watched && (
                <span className="text-[10px] uppercase tracking-wide text-muted border border-card-border rounded px-1.5 shrink-0">
                  not watched
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
