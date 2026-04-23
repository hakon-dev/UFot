import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getPlayerProfile,
  getPlayerHeader,
  getPlayerTransferHistory,
  buildPlayerTenures,
  type PlayerTenure,
} from "@/lib/player-stats";

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
  const tenures = buildPlayerTenures(transfers, header.clubId);

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

function formatYear(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return String(d.getFullYear());
}

function TenureRow({ tenure }: { tenure: PlayerTenure }) {
  const logo = tenure.clubLogo;
  const name = tenure.clubName ?? "Unknown";
  const startYear = formatYear(tenure.startDate);
  const endLabel = tenure.isCurrent
    ? "present"
    : tenure.endDate
    ? formatYear(tenure.endDate)
    : null;
  const range = endLabel ? `${startYear} – ${endLabel}` : startYear;

  const clubInner = (
    <span className="inline-flex items-center gap-2 min-w-0">
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt={name} className="w-5 h-5 object-contain shrink-0" />
      ) : (
        <span className="w-5 h-5 shrink-0" />
      )}
      <span className="truncate text-slate-200">{name}</span>
    </span>
  );

  return (
    <li className="flex items-center gap-3 text-sm py-2.5">
      <div className="flex-1 min-w-0">
        {tenure.clubId != null ? (
          <Link
            href={`/teams/${tenure.clubId}`}
            className="hover:text-accent transition-colors inline-flex min-w-0 max-w-full"
          >
            {clubInner}
          </Link>
        ) : (
          clubInner
        )}
      </div>
      <span className="text-xs text-muted tabular-nums shrink-0">{range}</span>
      {tenure.isLoan && (
        <span className="text-[10px] text-yellow-300 border border-yellow-300/40 rounded-full px-2 py-0.5 shrink-0 uppercase tracking-wide">
          Loan
        </span>
      )}
    </li>
  );
}
