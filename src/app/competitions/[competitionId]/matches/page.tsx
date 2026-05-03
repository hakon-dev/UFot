import Link from "next/link";
import { notFound } from "next/navigation";
import { getCompetition, getMatchesWithDetails } from "@/lib/db";
import { minutesOf } from "@/lib/stats-aggregation";
import PagedMatchList, { type PagedMatchItem } from "@/components/PagedMatchList";

export const dynamic = "force-dynamic";

export default async function CompetitionMatchesPage({
  params,
}: {
  params: Promise<{ competitionId: string }>;
}) {
  const { competitionId } = await params;
  const idNum = parseInt(competitionId, 10);
  if (!Number.isFinite(idNum)) notFound();

  const competition = getCompetition(idNum);
  if (!competition) notFound();

  const allMatches = getMatchesWithDetails();
  const matches = allMatches.filter(
    (m) =>
      m.competition_id === idNum ||
      (m.competition_id == null && m.competition === competition.name)
  );
  if (matches.length === 0) notFound();

  const items: PagedMatchItem[] = [...matches]
    .sort((a, b) => (a.date < b.date ? 1 : -1))
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
        watchedInPerson: m.watched_in_person === 1,
      },
      perspective: { kind: "neutral" },
    }));

  return (
    <div className="space-y-6">
      <Link href={`/competitions/${idNum}`} className="text-sm text-muted hover:text-accent transition-colors inline-flex items-center gap-1.5">
        <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
        </svg>
        Back to {competition.name}
      </Link>

      <h1 className="text-2xl font-bold text-white">{competition.name} — All Matches Watched</h1>

      <div className="bg-card rounded-xl p-5 border border-card-border">
        <PagedMatchList items={items} pageSize={null} />
      </div>
    </div>
  );
}
