import Link from "next/link";
import { getAllMatches } from "@/lib/db";
import { minutesOf } from "@/lib/stats-aggregation";
import PagedMatchList, { type PagedMatchItem } from "@/components/PagedMatchList";

export const dynamic = "force-dynamic";

export default function InPersonMatchesPage() {
  const matches = getAllMatches().filter((m) => m.watched_in_person === 1);
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
      watchedInPerson: true,
    },
    perspective: { kind: "neutral" },
  }));

  return (
    <div className="space-y-6">
      <Link href="/stats" className="text-sm text-muted hover:text-accent transition-colors inline-flex items-center gap-1.5">
        <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
        </svg>
        Back to stats
      </Link>

      <h1 className="text-2xl font-bold text-white">Matches Watched In Person</h1>

      <div className="bg-card rounded-xl p-5 border border-card-border">
        <PagedMatchList items={items} pageSize={null} />
      </div>
    </div>
  );
}
