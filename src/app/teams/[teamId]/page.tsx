import Link from "next/link";
import { notFound } from "next/navigation";
import { classifyNationalTeam, getTeamProfile, getTeamPlayers } from "@/lib/team-stats";
import { enrichPlayerStatsWithNationality, enrichPlayerStatsWithClub } from "@/lib/player-stats";
import { classifyTeamGender } from "@/lib/gender";
import PlayerStatsTable from "@/app/stats/PlayerStatsTable";
import PagedMatchList, { type PagedMatchItem } from "@/components/PagedMatchList";
import SectionHeader from "@/components/SectionHeader";
import RankLine from "@/components/RankLine";
import { getTeamRank } from "@/lib/rank";

export const dynamic = "force-dynamic";

export default async function TeamPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
  const idNum = parseInt(teamId, 10);
  if (!Number.isFinite(idNum)) notFound();
  const [team, rankItems] = await Promise.all([
    getTeamProfile(idNum),
    getTeamRank(idNum),
  ]);
  if (!team) notFound();

  const classification = team.national ? classifyNationalTeam(team.name) : null;
  const eyebrowParts = classification
    ? [
        "National team",
        classification.gender === "women" ? "Women" : "Men",
        classification.isSenior ? "Senior" : `U-${classification.age}`,
      ]
    : [];

  const teamPlayers = getTeamPlayers(idNum);
  await enrichPlayerStatsWithNationality(teamPlayers);
  await enrichPlayerStatsWithClub(teamPlayers);

  const cardClass = "bg-card rounded-xl p-5 border border-card-border";

  return (
    <div className="space-y-6">
      <Link href="/stats" className="text-sm text-muted hover:text-accent transition-colors inline-flex items-center gap-1.5">
        <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
        </svg>
        Back to stats
      </Link>

      <div className={`${cardClass} ${team.national ? "border-accent/40" : ""}`}>
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={team.crestUrl}
            alt={team.name}
            className="w-16 h-16 object-contain"
          />
          <div className="flex-1 min-w-0">
            {classification && (
              <p className="text-[11px] uppercase tracking-[0.18em] font-semibold text-accent mb-1">
                {eyebrowParts.join(" · ")}
              </p>
            )}
            <h1 className="text-2xl font-bold text-white">{team.name}</h1>
            <p className="text-sm text-muted">
              {team.totalMatches} match{team.totalMatches === 1 ? "" : "es"} watched
            </p>
            <RankLine items={rankItems} />
          </div>
        </div>
      </div>

      {team.country && team.countryCode && (
        <Link
          href={`/countries/${team.countryCode}`}
          className={`${cardClass} flex items-center gap-3 hover:border-accent/40 hover:text-accent transition-colors group`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://flagcdn.com/${team.countryCode}.svg`}
            alt=""
            className="w-10 h-7 object-cover rounded ring-1 ring-card-border shrink-0"
          />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Country</p>
            <p className="text-base font-semibold text-white group-hover:text-accent">
              {team.country}
            </p>
          </div>
          <span className="text-muted text-sm shrink-0">View →</span>
        </Link>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Wins" value={team.wins} />
        <StatCard label="Draws" value={team.draws} />
        <StatCard label="Losses" value={team.losses} />
        <StatCard label="Matches" value={team.totalMatches} />
        <StatCard label="Goals For" value={team.goalsFor} />
        <StatCard label="Goals Against" value={team.goalsAgainst} />
        <StatCard label="Goal Diff" value={team.goalsFor - team.goalsAgainst >= 0 ? `+${team.goalsFor - team.goalsAgainst}` : `${team.goalsFor - team.goalsAgainst}`} />
        <StatCard label="Minutes" value={team.totalMinutes} />
      </div>

      {team.totalMatches === 0 ? (
        <div className={cardClass}>
          <p className="text-muted text-center py-6">
            You haven&apos;t watched {team.name} yet. Add a match featuring this team and stats will populate here.
          </p>
        </div>
      ) : (
        <>
          {teamPlayers.length > 0 && (
            <div className={cardClass}>
              <SectionHeader title="Most Watched Players" seeAllHref={`/teams/${idNum}/players`} />
              <PlayerStatsTable players={teamPlayers} pageSize={10} defaultGender={classifyTeamGender(team.name)} />
            </div>
          )}

          <div className={cardClass}>
            <SectionHeader title="Matches Watched" seeAllHref={`/teams/${idNum}/matches`} />
            <PagedMatchList
              items={team.appearances.map<PagedMatchItem>((a) => ({
                match: {
                  matchId: a.matchId,
                  date: a.date,
                  homeTeam: a.homeTeam,
                  homeTeamId: a.homeTeamId,
                  homeCrest: a.homeCrest,
                  homeScore: a.homeScore,
                  awayTeam: a.awayTeam,
                  awayTeamId: a.awayTeamId,
                  awayCrest: a.awayCrest,
                  awayScore: a.awayScore,
                  minutesWatched: a.minutesWatched,
                  watchedInPerson: a.watchedInPerson,
                },
                perspective: { kind: "team", teamId: idNum },
              }))}
              pageSize={10}
            />
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-card rounded-xl p-4 border border-card-border">
      <p className="text-xs text-muted">{label}</p>
      <p className="text-2xl font-bold text-accent mt-1 tabular-nums">{value}</p>
    </div>
  );
}
