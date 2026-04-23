import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getPlayerProfile, getPlayerHeader, getPlayerTransferHistory, buildPlayerTenures,
  type PlayerProfile, type PlayerTenure,
} from "@/lib/player-stats";
import PlayerPhoto from "./PlayerPhoto";
import PagedMatchList, { type PagedMatchItem } from "@/components/PagedMatchList";
import SectionHeader from "@/components/SectionHeader";

export const dynamic = "force-dynamic";

export default async function PlayerPage({
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

  const cardClass = "bg-card rounded-xl p-5 border border-card-border";

  return (
    <div className="space-y-6">
      <Link href="/stats" className="text-sm text-muted hover:text-accent transition-colors inline-flex items-center gap-1.5">
        <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
        </svg>
        Back to stats
      </Link>

      <div className={cardClass}>
        <div className="flex items-start gap-4 flex-wrap">
          <PlayerPhoto src={header.photoUrl} name={header.name} size="lg" />
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-white">{header.name}</h1>
            <p className="text-sm text-muted mt-1">
              {profile
                ? `${profile.totalMatches} match${profile.totalMatches === 1 ? "" : "es"} watched`
                : "No watched appearances yet."}
            </p>
            <HeaderChips header={header} />
          </div>
        </div>
      </div>

      {profile ? <StatsGrid profile={profile} /> : null}

      {profile && profile.appearances.length > 0 && (
        <div className={cardClass}>
          <SectionHeader title="Appearances" seeAllHref={`/players/${idNum}/appearances`} />
          <PagedMatchList
            items={profile.appearances.map<PagedMatchItem>((a) => ({
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
              perspective: { kind: "player", teamId: a.teamId },
              extras: {
                goals: a.goalsWatched,
                assists: a.assistsWatched,
                yellows: a.yellowsWatched,
                reds: a.redsWatched,
              },
            }))}
            pageSize={10}
          />
        </div>
      )}

      {(() => {
        const tenures = buildPlayerTenures(transfers, header.clubId);
        if (tenures.length === 0) return null;
        const visible = tenures.slice(0, 10);
        const hasMore = tenures.length > 10;
        return (
          <div className={cardClass}>
            <SectionHeader
              title="Club history"
              seeAllHref={hasMore ? `/players/${idNum}/clubs` : undefined}
            />
            <ol className="[&>*]:border-b [&>*]:border-card-border/50">
              {visible.map((t, i) => (
                <TenureRow key={`${t.clubId ?? t.clubName}-${t.startDate}-${i}`} tenure={t} />
              ))}
            </ol>
          </div>
        );
      })()}
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
          <Link href={`/teams/${tenure.clubId}`} className="hover:text-accent transition-colors inline-flex min-w-0 max-w-full">
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

function HeaderChips({
  header,
}: {
  header: Awaited<ReturnType<typeof getPlayerHeader>>;
}) {
  const chips: React.ReactNode[] = [];

  if (header.clubName) {
    const inner = (
      <span className="inline-flex items-center gap-1.5">
        {header.clubCrest && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={header.clubCrest} alt={header.clubName} className="w-4 h-4 object-contain" />
        )}
        <span>{header.clubName}</span>
      </span>
    );
    chips.push(
      header.clubId != null ? (
        <Link
          key="club"
          href={`/teams/${header.clubId}`}
          className="px-2.5 py-1 rounded-full bg-surface border border-card-border text-xs text-slate-200 hover:text-accent transition-colors"
        >
          {inner}
        </Link>
      ) : (
        <span
          key="club"
          className="px-2.5 py-1 rounded-full bg-surface border border-card-border text-xs text-slate-200"
        >
          {inner}
        </span>
      )
    );
  }

  if (header.nationality) {
    const inner = (
      <span className="inline-flex items-center gap-1.5">
        {header.countryCode && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`https://flagcdn.com/${header.countryCode}.svg`}
            alt={header.nationality}
            className="w-4 h-3 object-cover rounded-[1px]"
          />
        )}
        <span>{header.nationality}</span>
      </span>
    );
    chips.push(
      header.countryCode ? (
        <Link
          key="nat"
          href={`/countries/${header.countryCode}`}
          className="px-2.5 py-1 rounded-full bg-surface border border-card-border text-xs text-slate-200 hover:text-accent transition-colors"
        >
          {inner}
        </Link>
      ) : (
        <span
          key="nat"
          className="px-2.5 py-1 rounded-full bg-surface border border-card-border text-xs text-slate-200"
        >
          {inner}
        </span>
      )
    );
  }

  if (header.position) {
    chips.push(
      <span
        key="pos"
        className="px-2.5 py-1 rounded-full bg-surface border border-card-border text-xs text-slate-200"
      >
        {header.position}
      </span>
    );
  }

  if (header.shirtNumber != null) {
    chips.push(
      <span
        key="num"
        className="px-2.5 py-1 rounded-full bg-surface border border-card-border text-xs text-slate-200 tabular-nums"
      >
        #{header.shirtNumber}
      </span>
    );
  }

  if (chips.length === 0) return null;

  return <div className="flex flex-wrap gap-2 mt-3">{chips}</div>;
}

function StatsGrid({ profile }: { profile: PlayerProfile }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
      <StatCard label="Minutes" value={profile.totalMinutes} />
      <StatCard label="Matches" value={profile.totalMatches} />
      <StatCard label="Goals" value={profile.totalGoals} />
      <StatCard label="Assists" value={profile.totalAssists} />
      <StatCard label="Yellows" value={profile.totalYellows} accent="yellow" />
      <StatCard label="Reds" value={profile.totalReds} accent="red" />
    </div>
  );
}

function StatCard({
  label,
  value,
  accent = "accent",
}: {
  label: string;
  value: string | number;
  accent?: "accent" | "yellow" | "red";
}) {
  const color =
    accent === "yellow" ? "text-yellow-400" : accent === "red" ? "text-red-400" : "text-accent";
  return (
    <div className="bg-card rounded-xl p-4 border border-card-border">
      <p className="text-xs text-muted">{label}</p>
      <p className={`text-2xl font-bold mt-1 tabular-nums ${color}`}>{value}</p>
    </div>
  );
}
