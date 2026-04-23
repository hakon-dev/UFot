import Link from "next/link";
import { getAllMatches, getMatchesWithDetails, getStadiumAggregates } from "@/lib/db";
import { hydratePendingMatches } from "@/lib/match-hydration";
import { computePlayerStats, enrichPlayerStatsWithNationality, enrichPlayerStatsWithClub } from "@/lib/player-stats";
import { enrichTeamRecordsWithCountry } from "@/lib/team-stats";
import { enrichCompetitionRecordsWithDetails } from "@/lib/competition-stats";
import { aggregateCompetitions, aggregateTeams, minutesOf } from "@/lib/stats-aggregation";
import PlayerStatsTable from "./PlayerStatsTable";
import CompetitionStatsTable from "./CompetitionStatsTable";
import TeamStatsTable from "./TeamStatsTable";
import StadiumStatsTable, { type StadiumStat } from "../stadiums/StadiumStatsTable";
import PagedMatchList, { type PagedMatchItem } from "@/components/PagedMatchList";

export const dynamic = "force-dynamic";

function OverviewCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-card rounded-xl p-5 border border-card-border flex flex-col items-center text-center">
      <p className="text-xs uppercase tracking-wide text-muted leading-tight min-h-[2rem] flex items-center">
        {label}
      </p>
      <p className="text-3xl font-bold text-accent tabular-nums mt-1">{value}</p>
    </div>
  );
}

function SectionHeader({ title, href }: { title: string; href: string }) {
  return (
    <Link
      href={href}
      className="group flex items-baseline justify-between mb-4 -mx-1 px-1 rounded hover:bg-surface/40 transition-colors"
    >
      <h2 className="text-lg font-semibold text-white group-hover:text-accent transition-colors">
        {title}
      </h2>
      <span className="text-xs text-muted group-hover:text-accent transition-colors shrink-0 ml-3">
        See all →
      </span>
    </Link>
  );
}

export default async function StatsPage() {
  await hydratePendingMatches(5);

  const matches = getAllMatches();

  const totalMatches = matches.length;
  const totalGoals = matches.reduce((sum, m) => sum + m.home_score + m.away_score, 0);
  const totalMinutesWatched = matches.reduce((sum, m) => sum + minutesOf(m.watch_intervals), 0);
  const inPersonCount = matches.reduce((n, m) => n + (m.watched_in_person === 1 ? 1 : 0), 0);

  const stadiumAggregates = getStadiumAggregates();
  const stadiumTotalRows: StadiumStat[] = stadiumAggregates.map((a) => ({
    venueId: a.venueId,
    venueName: a.venueName,
    venueCity: a.venueCity,
    matches: a.totalMatches,
    minutes: a.totalMinutes,
  }));
  const stadiumInPersonRows: StadiumStat[] = stadiumAggregates
    .filter((a) => a.inPersonMatches > 0)
    .map((a) => ({
      venueId: a.venueId,
      venueName: a.venueName,
      venueCity: a.venueCity,
      matches: a.inPersonMatches,
      minutes: a.inPersonMinutes,
    }));

  const matchesWithDetails = getMatchesWithDetails();

  // Enrich teams first so national-team flags are populated in the teams cache before
  // computePlayerStats runs — otherwise `recordClub`'s national skip can miss uncached teams
  // and a national team ends up as a player's "club".
  const teams = aggregateTeams(matches);
  await enrichTeamRecordsWithCountry(teams);

  const playerStats = computePlayerStats(matchesWithDetails);
  await enrichPlayerStatsWithNationality(playerStats);
  await enrichPlayerStatsWithClub(playerStats);

  const competitions = aggregateCompetitions(matches);
  await enrichCompetitionRecordsWithDetails(competitions);

  const inPersonItems: PagedMatchItem[] = matches
    .filter((m) => m.watched_in_person === 1)
    .map((m) => ({
      match: {
        matchId: m.id,
        date: m.date,
        homeTeam: m.home_team,
        homeTeamId: m.home_team_id,
        homeCrest: m.home_crest,
        homeScore: m.home_score,
        awayTeam: m.away_team,
        awayTeamId: m.away_team_id,
        awayCrest: m.away_crest,
        awayScore: m.away_score,
        minutesWatched: minutesOf(m.watch_intervals),
        watchedInPerson: true,
      },
      perspective: { kind: "neutral" },
    }));

  const sectionClass = "bg-card rounded-xl p-6 border border-card-border";

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Statistics</h1>

      {totalMatches === 0 ? (
        <p className="text-muted text-lg text-center py-16">
          No matches watched yet. Add some matches to see your stats!
        </p>
      ) : (
        <div className="space-y-6">
          {/* Overview — labels aligned on the same baseline, numbers aligned below */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4">
            <OverviewCard label="Matches Watched" value={totalMatches} />
            <OverviewCard label="Total Minutes" value={totalMinutesWatched.toLocaleString()} />
            <OverviewCard label="Total Goals Seen" value={totalGoals} />
            <OverviewCard label="Teams Watched" value={teams.length} />
            <OverviewCard label="Players Watched" value={playerStats.length} />
            <OverviewCard label="Competitions Watched" value={competitions.length} />
            <OverviewCard label="Matches In Person" value={inPersonCount} />
          </div>

          {/* Most Watched Teams */}
          <div className={sectionClass}>
            <SectionHeader title="Most Watched Teams" href="/stats/teams" />
            <TeamStatsTable teams={teams} pageSize={10} />
          </div>

          {/* Most Watched Players */}
          {playerStats.length > 0 && (
            <div className={sectionClass}>
              <SectionHeader title="Most Watched Players" href="/stats/players" />
              <PlayerStatsTable players={playerStats} pageSize={10} />
            </div>
          )}

          {/* Most Watched Competitions */}
          <div className={sectionClass}>
            <SectionHeader title="Most Watched Competitions" href="/stats/competitions" />
            <CompetitionStatsTable competitions={competitions} pageSize={10} />
          </div>

          {/* Most Watched Stadiums */}
          {stadiumTotalRows.length > 0 && (
            <div className={sectionClass}>
              <SectionHeader title="Most Watched Stadiums" href="/stadiums" />
              <StadiumStatsTable stadiums={stadiumTotalRows} pageSize={10} />
            </div>
          )}

          {/* In-Person Stadiums */}
          {stadiumInPersonRows.length > 0 && (
            <div className={sectionClass}>
              <SectionHeader title="Most Watched Stadiums (In Person)" href="/stadiums/in-person" />
              <StadiumStatsTable stadiums={stadiumInPersonRows} pageSize={10} matchesLabel="Visits" />
            </div>
          )}

          {/* In-Person Matches */}
          {inPersonItems.length > 0 && (
            <div className={sectionClass}>
              <SectionHeader title="Matches Watched In Person" href="/stats/in-person" />
              <PagedMatchList items={inPersonItems} pageSize={10} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
