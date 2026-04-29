import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getPlayerProfile,
  getPlayerHeader,
  getPlayerTransferHistory,
  getPlayerClubHistory,
} from "@/lib/player-stats";
import TenureRow from "../TenureRow";

export const dynamic = "force-dynamic";

export default async function PlayerClubHistoryPage({
  params,
}: {
  params: Promise<{ playerId: string }>;
}) {
  const { playerId } = await params;
  const idNum = parseInt(playerId, 10);
  if (!Number.isFinite(idNum)) notFound();

  const profile = getPlayerProfile(idNum);
  const [header, transfers] = await Promise.all([
    getPlayerHeader(idNum, profile),
    getPlayerTransferHistory(idNum),
  ]);
  const tenures = getPlayerClubHistory(idNum, transfers, header.clubId);

  return (
    <div className="space-y-6">
      <Link
        href={`/players/${idNum}`}
        className="text-sm text-muted hover:text-accent transition-colors inline-flex items-center gap-1.5"
      >
        <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
            clipRule="evenodd"
          />
        </svg>
        Back to {header.name}
      </Link>

      <h1 className="text-2xl font-bold text-white">Club history — {header.name}</h1>

      <div className="bg-card rounded-xl p-5 border border-card-border">
        {tenures.length === 0 ? (
          <p className="text-muted text-sm">No transfer history available yet.</p>
        ) : (
          <ol className="[&>*]:border-b [&>*]:border-card-border/50">
            {tenures.map((t, i) => (
              <TenureRow key={`${t.clubId ?? t.clubName}-${t.startDate}-${i}`} tenure={t} />
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

