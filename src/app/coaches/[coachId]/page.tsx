import Link from "next/link";
import { notFound } from "next/navigation";
import { getCoachProfile } from "@/lib/coach-stats";
import PagedMatchList, { type PagedMatchItem } from "@/components/PagedMatchList";
import SectionHeader from "@/components/SectionHeader";

export const dynamic = "force-dynamic";

export default async function CoachDetailPage({
  params,
}: {
  params: Promise<{ coachId: string }>;
}) {
  const { coachId } = await params;
  const idNum = parseInt(coachId, 10);
  if (!Number.isFinite(idNum)) notFound();

  const profile = await getCoachProfile(idNum);
  if (!profile || profile.totalMatches === 0) notFound();

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
    perspective: { kind: "player", teamId: a.teamId },
  }));

  const cardClass = "bg-card rounded-xl p-5 border border-card-border";

  return (
    <div className="space-y-6">
      <Link href="/coaches" className="text-sm text-muted hover:text-accent transition-colors inline-flex items-center gap-1.5">
        <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
        </svg>
        Back to coaches
      </Link>

      <div className={cardClass}>
        <div className="flex items-center gap-4">
          {profile.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.photo}
              alt={profile.name}
              className="w-20 h-20 rounded-full object-cover bg-surface ring-1 ring-card-border"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-surface ring-1 ring-card-border flex items-center justify-center">
              <span className="text-2xl font-bold text-muted">
                {profile.name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
              </span>
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-white truncate">{profile.name}</h1>
            {profile.nationality && (
              profile.countryCode ? (
                <Link
                  href={`/countries/${profile.countryCode}`}
                  className="mt-1 inline-flex items-center gap-2 text-sm text-muted hover:text-accent transition-colors"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`https://flagcdn.com/${profile.countryCode}.svg`}
                    alt={profile.nationality}
                    className="w-5 h-3.5 object-cover rounded-sm ring-1 ring-card-border"
                  />
                  {profile.nationality}
                </Link>
              ) : (
                <p className="mt-1 text-sm text-muted">{profile.nationality}</p>
              )
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard label="Matches" value={profile.totalMatches} />
        <StatCard label="Minutes" value={profile.totalMinutes.toLocaleString()} />
        <StatCard label="Wins" value={profile.wins} />
        <StatCard label="Draws" value={profile.draws} />
        <StatCard label="Losses" value={profile.losses} />
      </div>

      <div className={cardClass}>
        <SectionHeader title="Matches Coached" seeAllHref={`/coaches/${idNum}/matches`} />
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
