import Link from "next/link";
import { notFound } from "next/navigation";
import { getMatchesByRefereeName } from "@/lib/db";
import { buildRefereeProfile } from "@/lib/coach-stats";
import PagedMatchList, { type PagedMatchItem } from "@/components/PagedMatchList";
import SectionHeader from "@/components/SectionHeader";
import RankLine from "@/components/RankLine";
import { getRefereeRank } from "@/lib/rank";

export const dynamic = "force-dynamic";

export default async function RefereeDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const name = decodeURIComponent(slug);
  const matches = getMatchesByRefereeName(name);
  const profile = buildRefereeProfile(name, matches);
  if (!profile) notFound();

  const rankItems = getRefereeRank(name);

  const inPersonCount = profile.appearances.filter((a) => a.watchedInPerson).length;
  const first = profile.appearances[profile.appearances.length - 1];
  const latest = profile.appearances[0];

  const items: PagedMatchItem[] = profile.appearances.map((a) => ({
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
    perspective: { kind: "neutral" },
  }));

  const cardClass = "bg-card rounded-xl p-5 border border-card-border";

  return (
    <div className="space-y-6">
      <Link href="/referees" className="text-sm text-muted hover:text-accent transition-colors inline-flex items-center gap-1.5">
        <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
        </svg>
        Back to referees
      </Link>

      <div className={cardClass}>
        <h1 className="text-2xl font-bold text-white">{profile.name}</h1>
        <p className="text-sm text-muted mt-1">Referee</p>
        <RankLine items={rankItems} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard label="Matches" value={profile.totalMatches} />
        <StatCard label="Minutes" value={profile.totalMinutes.toLocaleString()} />
        <StatCard label="In Person" value={inPersonCount} />
        <StatCard label="First" value={formatDate(first.date)} />
        <StatCard label="Last" value={formatDate(latest.date)} />
      </div>

      <div className={cardClass}>
        <SectionHeader title="Matches Refereed" seeAllHref={`/referees/${encodeURIComponent(name)}/matches`} />
        <PagedMatchList items={items} pageSize={10} />
      </div>
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

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
