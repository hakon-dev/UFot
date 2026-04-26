import Link from "next/link";
import { notFound } from "next/navigation";
import { getTeamProfile, getTeamPlayers } from "@/lib/team-stats";
import { enrichPlayerStatsWithNationality, enrichPlayerStatsWithClub } from "@/lib/player-stats";
import PlayerStatsTable from "@/app/stats/PlayerStatsTable";

export const dynamic = "force-dynamic";

export default async function TeamPlayersPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
  const idNum = parseInt(teamId, 10);
  if (!Number.isFinite(idNum)) notFound();
  const team = await getTeamProfile(idNum);
  if (!team) notFound();

  const players = getTeamPlayers(idNum);
  await enrichPlayerStatsWithNationality(players);
  await enrichPlayerStatsWithClub(players);

  return (
    <div className="space-y-6">
      <Link href={`/teams/${idNum}`} className="text-sm text-muted hover:text-accent transition-colors inline-flex items-center gap-1.5">
        <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
        </svg>
        Back to {team.name}
      </Link>

      <h1 className="text-2xl font-bold text-white">{team.name} — All Players Watched</h1>

      <div className="bg-card rounded-xl p-5 border border-card-border">
        <PlayerStatsTable players={players} pageSize={null} />
      </div>
    </div>
  );
}
