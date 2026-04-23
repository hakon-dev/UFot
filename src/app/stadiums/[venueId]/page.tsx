import Link from "next/link";
import { notFound } from "next/navigation";
import { getMatchesByVenueId } from "@/lib/db";
import { minutesOf } from "@/lib/stats-aggregation";
import PagedMatchList, { type PagedMatchItem } from "@/components/PagedMatchList";
import SectionHeader from "@/components/SectionHeader";

export const dynamic = "force-dynamic";

export default async function StadiumDetailPage({
  params,
}: {
  params: Promise<{ venueId: string }>;
}) {
  const { venueId } = await params;
  const idNum = parseInt(venueId, 10);
  if (!Number.isFinite(idNum)) notFound();

  const matches = getMatchesByVenueId(idNum);
  if (matches.length === 0) notFound();

  const first = matches[matches.length - 1];
  const latest = matches[0];
  const venueName = matches.find((m) => m.venue)?.venue || "Unknown";
  const venueCity = matches.find((m) => m.venue_city)?.venue_city ?? null;

  let totalMinutes = 0;
  let inPersonMinutes = 0;
  let inPersonCount = 0;
  for (const m of matches) {
    const mins = minutesOf(m.watch_intervals);
    totalMinutes += mins;
    if (m.watched_in_person === 1) {
      inPersonMinutes += mins;
      inPersonCount += 1;
    }
  }

  const items: PagedMatchItem[] = matches.map((m) => ({
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

  const cardClass = "bg-card rounded-xl p-5 border border-card-border";

  return (
    <div className="space-y-6">
      <Link href="/stadiums" className="text-sm text-muted hover:text-accent transition-colors inline-flex items-center gap-1.5">
        <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
        </svg>
        Back to stadiums
      </Link>

      <div className={cardClass}>
        <h1 className="text-2xl font-bold text-white">{venueName}</h1>
        {venueCity && <p className="text-sm text-muted mt-1">{venueCity}</p>}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard label="Matches" value={matches.length} />
        <StatCard label="In Person" value={inPersonCount} />
        <StatCard label="Minutes" value={totalMinutes.toLocaleString()} />
        <StatCard label="Minutes (In Person)" value={inPersonMinutes.toLocaleString()} />
        <StatCard label="First Visit" value={formatDate(first.date)} />
        <StatCard label="Last Visit" value={formatDate(latest.date)} />
      </div>

      <div className={cardClass}>
        <SectionHeader title="Matches Watched Here" seeAllHref={`/stadiums/${idNum}/matches`} />
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
