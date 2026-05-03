import Link from "next/link";
import { notFound } from "next/navigation";
import { getCompetition, getMatchesWithDetails } from "@/lib/db";
import { computePlayerStats, enrichPlayerStatsWithNationality, enrichPlayerStatsWithClub } from "@/lib/player-stats";
import { enrichTeamRecordsWithCountry } from "@/lib/team-stats";
import { isRegionName, resolveCompetitionRegion } from "@/lib/competition-stats";
import { aggregateTeams, minutesOf } from "@/lib/stats-aggregation";
import { pickDefaultGender } from "@/lib/gender";
import PlayerStatsTable from "@/app/stats/PlayerStatsTable";
import TeamStatsTable from "@/app/stats/TeamStatsTable";
import PagedMatchList, { type PagedMatchItem } from "@/components/PagedMatchList";
import SectionHeader from "@/components/SectionHeader";
import RankLine from "@/components/RankLine";
import { getCompetitionRank } from "@/lib/rank";

export const dynamic = "force-dynamic";

export default async function CompetitionPage({
  params,
}: {
  params: Promise<{ competitionId: string }>;
}) {
  const { competitionId } = await params;
  const idNum = parseInt(competitionId, 10);
  if (!Number.isFinite(idNum)) notFound();

  const competition = getCompetition(idNum);
  if (!competition) notFound();

  const region = resolveCompetitionRegion(
    competition.id,
    competition.country,
    competition.country_code
  );
  const regionIsRegion = isRegionName(region.country);

  // Match this competition's matches by ID first; legacy rows (competition_id NULL) are
  // included when their competition name matches, so older manually-entered matches still
  // roll up under the right league.
  const allMatches = getMatchesWithDetails();
  const matches = allMatches.filter(
    (m) =>
      m.competition_id === idNum ||
      (m.competition_id == null && m.competition === competition.name)
  );

  if (matches.length === 0) notFound();

  const defaultGender = pickDefaultGender(matches);
  const totalMinutes = matches.reduce((s, m) => s + minutesOf(m.watch_intervals), 0);

  const teams = aggregateTeams(matches);
  await enrichTeamRecordsWithCountry(teams);

  const players = computePlayerStats(matches);
  await enrichPlayerStatsWithNationality(players);
  await enrichPlayerStatsWithClub(players);

  const rankItems = await getCompetitionRank(idNum);

  const cardClass = "bg-card rounded-xl p-5 border border-card-border";
  const sectionClass = "bg-card rounded-xl p-6 border border-card-border";

  return (
    <div className="space-y-6">
      <Link href="/stats" className="text-sm text-muted hover:text-accent transition-colors inline-flex items-center gap-1.5">
        <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
        </svg>
        Back to stats
      </Link>

      <div className={cardClass}>
        <div className="flex items-center gap-4 flex-wrap">
          {competition.logo ? (
            <div className="w-16 h-16 rounded-lg bg-white/90 p-2 flex items-center justify-center shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={competition.logo}
                alt={competition.name}
                className="w-full h-full object-contain"
              />
            </div>
          ) : (
            <div className="w-16 h-16 rounded-lg bg-surface ring-1 ring-card-border" />
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-white">{competition.name}</h1>
            <p className="text-sm text-muted mt-1">
              {matches.length} match{matches.length === 1 ? "" : "es"} watched · {totalMinutes.toLocaleString()} min
            </p>
            <RankLine items={rankItems} />
            {region.country && (
              <div className="mt-2">
                {regionIsRegion ? (
                  <span className="px-2.5 py-1 rounded-full bg-surface border border-card-border text-xs text-slate-200 inline-flex items-center gap-1.5">
                    {region.countryCode ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`https://flagcdn.com/${region.countryCode}.svg`}
                        alt={region.country}
                        className="w-4 h-3 object-cover rounded-[1px]"
                      />
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="w-3.5 h-3.5 text-muted" aria-hidden>
                        <circle cx="12" cy="12" r="9" />
                        <path d="M3 12h18" />
                        <path d="M12 3a14 14 0 0 1 0 18" />
                        <path d="M12 3a14 14 0 0 0 0 18" />
                      </svg>
                    )}
                    {region.country}
                  </span>
                ) : region.countryCode ? (
                  <Link
                    href={`/countries/${region.countryCode}`}
                    className="px-2.5 py-1 rounded-full bg-surface border border-card-border text-xs text-slate-200 hover:text-accent transition-colors inline-flex items-center gap-1.5"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`https://flagcdn.com/${region.countryCode}.svg`}
                      alt={region.country}
                      className="w-4 h-3 object-cover rounded-[1px]"
                    />
                    {region.country}
                  </Link>
                ) : (
                  <span className="px-2.5 py-1 rounded-full bg-surface border border-card-border text-xs text-slate-200">
                    {region.country}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={sectionClass}>
        <SectionHeader title="Most Watched Teams" seeAllHref={`/competitions/${idNum}/teams`} />
        <TeamStatsTable teams={teams} pageSize={10} defaultGender={defaultGender} showGenderToggle={false} />
      </div>

      {players.length > 0 && (
        <div className={sectionClass}>
          <SectionHeader title="Most Watched Players" seeAllHref={`/competitions/${idNum}/players`} />
          <PlayerStatsTable players={players} pageSize={10} defaultGender={defaultGender} showGenderToggle={false} />
        </div>
      )}

      <div className={sectionClass}>
        <SectionHeader title="Matches Watched" seeAllHref={`/competitions/${idNum}/matches`} />
        <PagedMatchList
          items={[...matches]
            .sort((a, b) => (a.date < b.date ? 1 : -1))
            .map<PagedMatchItem>((m) => ({
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
                watchedInPerson: m.watched_in_person === 1,
              },
              perspective: { kind: "neutral" },
            }))}
          pageSize={10}
        />
      </div>
    </div>
  );
}
