import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getPlayerProfile, getPlayerHeader, getPlayerTransferHistory,
  type PlayerProfile,
} from "@/lib/player-stats";
import PlayerPhoto from "./PlayerPhoto";

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
          <h2 className="text-lg font-semibold text-white mb-4">Appearances</h2>
          <div className="space-y-2">
            {profile.appearances.map((a) => (
              <Link
                key={a.matchId}
                href={`/matches/${a.matchId}`}
                className="flex items-center gap-3 text-sm hover:bg-surface rounded-lg px-2 py-2 transition-colors"
              >
                <div className="flex-1 min-w-0 flex items-center gap-2">
                  {a.homeCrest && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.homeCrest} alt={a.homeTeam} className="w-4 h-4 object-contain" />
                  )}
                  <span className={`truncate ${a.team === "home" ? "text-accent" : "text-slate-200"}`}>
                    {a.homeTeam}
                  </span>
                  <span className="text-muted tabular-nums px-1">
                    {a.homeScore} - {a.awayScore}
                  </span>
                  <span className={`truncate ${a.team === "away" ? "text-accent" : "text-slate-200"}`}>
                    {a.awayTeam}
                  </span>
                  {a.awayCrest && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.awayCrest} alt={a.awayTeam} className="w-4 h-4 object-contain" />
                  )}
                </div>
                <span className="text-xs text-muted shrink-0 tabular-nums">{a.minutesWatched} min</span>
                {a.goalsWatched > 0 && (
                  <span className="text-xs text-accent shrink-0 tabular-nums">
                    {a.goalsWatched}G
                  </span>
                )}
                {a.assistsWatched > 0 && (
                  <span className="text-xs text-muted shrink-0 tabular-nums">
                    {a.assistsWatched}A
                  </span>
                )}
                {a.yellowsWatched > 0 && (
                  <span className="text-xs text-yellow-400 shrink-0 tabular-nums">
                    {a.yellowsWatched}Y
                  </span>
                )}
                {a.redsWatched > 0 && (
                  <span className="text-xs text-red-400 shrink-0 tabular-nums">
                    {a.redsWatched}R
                  </span>
                )}
                <span className="text-xs text-muted shrink-0 tabular-nums">
                  {new Date(a.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {transfers.length > 0 && (
        <div className={cardClass}>
          <h2 className="text-lg font-semibold text-white mb-4">Club history</h2>
          <ol className="space-y-3">
            {transfers.map((t, i) => (
              <li key={i} className="flex items-center gap-3 text-sm">
                <span className="text-muted tabular-nums w-24 shrink-0">
                  {t.date ? formatDate(t.date) : ""}
                </span>
                <TeamChip
                  id={t.teamOut.id}
                  name={t.teamOut.name}
                  logo={t.teamOut.logo}
                  muted
                />
                <span className="text-muted">→</span>
                <TeamChip
                  id={t.teamIn.id}
                  name={t.teamIn.name}
                  logo={t.teamIn.logo}
                />
                {t.type && (
                  <span className="text-[10px] text-muted border border-card-border rounded-full px-2 py-0.5 shrink-0">
                    {t.type}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

function formatDate(isoOrDate: string): string {
  const d = new Date(isoOrDate);
  if (Number.isNaN(d.getTime())) return isoOrDate;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
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
    chips.push(
      <span
        key="nat"
        className="px-2.5 py-1 rounded-full bg-surface border border-card-border text-xs text-slate-200 inline-flex items-center gap-1.5"
      >
        {header.countryCode && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`https://flagcdn.com/${header.countryCode}.svg`}
            alt={header.nationality}
            className="w-4 h-3 object-cover rounded-[1px]"
          />
        )}
        {header.nationality}
      </span>
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

function TeamChip({
  id,
  name,
  logo,
  muted,
}: {
  id: number | null;
  name: string | null;
  logo: string | null;
  muted?: boolean;
}) {
  if (!name) return <span className="text-muted italic">—</span>;
  const inner = (
    <span className={`inline-flex items-center gap-1.5 ${muted ? "text-muted" : "text-slate-200"}`}>
      {logo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt={name} className="w-4 h-4 object-contain shrink-0" />
      )}
      <span className="truncate">{name}</span>
    </span>
  );
  if (id != null) {
    return (
      <Link href={`/teams/${id}`} className="hover:text-accent transition-colors max-w-[10rem]">
        {inner}
      </Link>
    );
  }
  return <span className="max-w-[10rem]">{inner}</span>;
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
