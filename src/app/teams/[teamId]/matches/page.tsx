import Link from "next/link";
import { notFound } from "next/navigation";
import { getTeamProfile } from "@/lib/team-stats";
import PagedMatchList, { type PagedMatchItem } from "@/components/PagedMatchList";

export const dynamic = "force-dynamic";

export default async function TeamMatchesPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
  const idNum = parseInt(teamId, 10);
  if (!Number.isFinite(idNum)) notFound();
  const team = getTeamProfile(idNum);
  if (!team) notFound();

  const items: PagedMatchItem[] = team.appearances.map((a) => ({
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
  }));

  return (
    <div className="space-y-6">
      <Link href={`/teams/${idNum}`} className="text-sm text-muted hover:text-accent transition-colors inline-flex items-center gap-1.5">
        <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
        </svg>
        Back to {team.name}
      </Link>

      <h1 className="text-2xl font-bold text-white">{team.name} — All Matches Watched</h1>

      <div className="bg-card rounded-xl p-5 border border-card-border">
        <PagedMatchList items={items} pageSize={null} />
      </div>
    </div>
  );
}
