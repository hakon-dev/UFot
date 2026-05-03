import Link from "next/link";
import type { PlayerTenure } from "@/lib/player-stats";

function formatYear(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return String(d.getFullYear());
}

export default function TenureRow({ tenure }: { tenure: PlayerTenure }) {
  const logo = tenure.clubLogo;
  const name = tenure.clubName ?? "Unknown";
  const startYear = tenure.startDate ? formatYear(tenure.startDate) : null;
  const endLabel = tenure.isCurrent
    ? "present"
    : tenure.endDate
    ? formatYear(tenure.endDate)
    : null;
  const range = startYear && endLabel
    ? `${startYear} – ${endLabel}`
    : startYear
    ? startYear
    : endLabel
    ? `until ${endLabel}`
    : "";

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
