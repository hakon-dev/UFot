import Link from "next/link";
import { notFound } from "next/navigation";
import { getMatchesBetweenTeams, getTeamHomeVenue, type Match } from "@/lib/db";
import { getTeamProfile } from "@/lib/team-stats";
import { minutesOf } from "@/lib/stats-aggregation";
import H2HContent, { type H2HBreakdown, type H2HItem, type H2HVenue } from "./H2HContent";

export const dynamic = "force-dynamic";

function emptyBreakdown(): H2HBreakdown {
  return { matches: 0, aWins: 0, draws: 0, bWins: 0, aGoals: 0, bGoals: 0 };
}

function classifyVenue(
  m: Match,
  aId: number,
  aHomeVenue: number | null,
  bHomeVenue: number | null
): H2HVenue {
  // Prefer venue-based classification: a match at a known home ground is "that team's home",
  // anything else with a known venue is neutral. When venue_id is missing or only one team's
  // home venue is known, fall back to the database's home/away designation.
  if (m.venue_id != null) {
    if (aHomeVenue != null && m.venue_id === aHomeVenue) return "a-home";
    if (bHomeVenue != null && m.venue_id === bHomeVenue) return "b-home";
    if (aHomeVenue != null && bHomeVenue != null) return "neutral";
  }
  return m.home_team_id === aId ? "a-home" : "b-home";
}

function tally(b: H2HBreakdown, aScore: number, bScore: number): void {
  b.matches += 1;
  b.aGoals += aScore;
  b.bGoals += bScore;
  if (aScore > bScore) b.aWins += 1;
  else if (aScore < bScore) b.bWins += 1;
  else b.draws += 1;
}

export default async function HeadToHeadPage({
  params,
}: {
  params: Promise<{ teamId: string; opponentId: string }>;
}) {
  const { teamId, opponentId } = await params;
  const aId = parseInt(teamId, 10);
  const bId = parseInt(opponentId, 10);
  if (!Number.isFinite(aId) || !Number.isFinite(bId) || aId === bId) notFound();

  const [teamA, teamB, matches, aHomeVenue, bHomeVenue] = await Promise.all([
    getTeamProfile(aId),
    getTeamProfile(bId),
    Promise.resolve(getMatchesBetweenTeams(aId, bId)),
    Promise.resolve(getTeamHomeVenue(aId)),
    Promise.resolve(getTeamHomeVenue(bId)),
  ]);
  if (!teamA || !teamB) notFound();

  const aHome = emptyBreakdown();
  const bHome = emptyBreakdown();
  const neutral = emptyBreakdown();
  const total = emptyBreakdown();

  const items: H2HItem[] = matches.map((m) => {
    const aIsHome = m.home_team_id === aId;
    const aScore = aIsHome ? m.home_score : m.away_score;
    const bScore = aIsHome ? m.away_score : m.home_score;
    const venue = classifyVenue(m, aId, aHomeVenue, bHomeVenue);
    if (venue === "a-home") tally(aHome, aScore, bScore);
    else if (venue === "b-home") tally(bHome, aScore, bScore);
    else tally(neutral, aScore, bScore);
    tally(total, aScore, bScore);
    return {
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
      perspective: { kind: "team", teamId: aId },
      venue,
    };
  });

  const cardClass = "bg-card rounded-xl p-5 border border-card-border";

  return (
    <div className="space-y-6">
      <Link
        href={`/teams/${aId}`}
        className="text-sm text-muted hover:text-accent transition-colors inline-flex items-center gap-1.5"
      >
        <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
            clipRule="evenodd"
          />
        </svg>
        Back to {teamA.name}
      </Link>

      <div className={cardClass}>
        <p className="text-[11px] uppercase tracking-[0.18em] font-semibold text-accent mb-3">
          Head to Head
        </p>
        <div className="flex items-center gap-4">
          <TeamHeader teamId={aId} name={teamA.name} crest={teamA.crestUrl} align="left" />
          <span className="text-xl font-bold text-muted shrink-0">vs</span>
          <TeamHeader teamId={bId} name={teamB.name} crest={teamB.crestUrl} align="right" />
        </div>
      </div>

      {matches.length === 0 ? (
        <div className={cardClass}>
          <p className="text-muted text-center py-6">
            You haven&apos;t watched a match between {teamA.name} and {teamB.name} yet.
          </p>
        </div>
      ) : (
        <H2HContent
          aName={teamA.name}
          bName={teamB.name}
          aHome={aHome}
          bHome={bHome}
          neutral={neutral}
          total={total}
          items={items}
        />
      )}
    </div>
  );
}

function TeamHeader({
  teamId,
  name,
  crest,
  align,
}: {
  teamId: number;
  name: string;
  crest: string;
  align: "left" | "right";
}) {
  const wrapper =
    align === "left"
      ? "flex items-center gap-3 flex-1 min-w-0"
      : "flex items-center gap-3 flex-1 min-w-0 justify-end";
  return (
    <Link
      href={`/teams/${teamId}`}
      className={`${wrapper} hover:text-accent transition-colors`}
    >
      {align === "left" && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={crest} alt={name} className="w-12 h-12 object-contain shrink-0" />
      )}
      <span
        className={`font-bold text-xl truncate ${align === "right" ? "text-right" : ""} text-slate-200`}
      >
        {name}
      </span>
      {align === "right" && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={crest} alt={name} className="w-12 h-12 object-contain shrink-0" />
      )}
    </Link>
  );
}
