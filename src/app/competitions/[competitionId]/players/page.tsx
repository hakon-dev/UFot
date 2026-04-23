import Link from "next/link";
import { notFound } from "next/navigation";
import { getCompetition, getMatchesWithDetails } from "@/lib/db";
import { computePlayerStats, enrichPlayerStatsWithNationality, enrichPlayerStatsWithClub } from "@/lib/player-stats";
import PlayerStatsTable from "@/app/stats/PlayerStatsTable";

export const dynamic = "force-dynamic";

export default async function CompetitionPlayersPage({
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

  const players = computePlayerStats(matches);
  await enrichPlayerStatsWithNationality(players);
  await enrichPlayerStatsWithClub(players);

  return (
    <div className="space-y-6">
      <Link href={`/competitions/${idNum}`} className="text-sm text-muted hover:text-accent transition-colors inline-flex items-center gap-1.5">
        <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
        </svg>
        Back to {competition.name}
      </Link>

      <h1 className="text-2xl font-bold text-white">{competition.name} — All Players Watched</h1>

      <div className="bg-card rounded-xl p-5 border border-card-border">
        <PlayerStatsTable players={players} pageSize={null} />
      </div>
    </div>
  );
}
