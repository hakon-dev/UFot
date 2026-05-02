import { getMatch, getCoaches, setMatchVenueId } from "@/lib/db";
import { hydrateMatchDetails } from "@/lib/match-hydration";
import { searchVenuesApi } from "@/lib/football-api";
import { formatRound } from "@/lib/format-round";
import { notFound } from "next/navigation";
import Link from "next/link";
import MatchDetailClient from "./MatchDetailClient";
import DeleteMatchButton from "./DeleteMatchButton";

export const dynamic = "force-dynamic";

export default async function MatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let match = getMatch(id);
  if (!match) notFound();

  // Older api-football rows predate the v10 venue backfill — hydrate inline so the venue
  // chip renders as a working link on the first page load instead of waiting for the
  // client-side details fetch to populate the cache.
  if (
    match.venue_id == null &&
    match.external_source === "api-football" &&
    match.external_match_id != null &&
    !match.details_complete
  ) {
    await hydrateMatchDetails(id);
    match = getMatch(id) ?? match;
  }

  // API-Football's fixture payload sometimes carries `venue.name` with `venue.id = null` (the
  // venue isn't in their indexed venues database). Fall back to a `/venues?search=` lookup so
  // the chip still becomes a clickable link. `venue_search_attempted` records the attempt so a
  // null result doesn't burn a fresh API call on every page view.
  if (
    match.venue &&
    match.venue_id == null &&
    !match.venue_search_attempted &&
    match.external_source === "api-football"
  ) {
    try {
      const hits = await searchVenuesApi(match.venue);
      const wanted = match.venue.toLowerCase();
      const best =
        hits.find((v) => v.name.toLowerCase() === wanted) ??
        hits.find((v) => v.name.toLowerCase().includes(wanted)) ??
        hits[0] ??
        null;
      setMatchVenueId(id, best?.id ?? null);
      match = getMatch(id) ?? match;
    } catch {
      // best-effort — don't mark attempted on transient error so the next view can retry.
    }
  }

  const dateStr = new Date(match.date).toLocaleDateString("en-GB", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const hadExtraTime = match.had_extra_time === 1;
  const matchLength: 90 | 120 = hadExtraTime ? 120 : 90;
  const defaultIntervals = hadExtraTime ? "[[0,120]]" : "[[0,90]]";
  let watchIntervals: number[][];
  try {
    watchIntervals = JSON.parse(match.watch_intervals || defaultIntervals);
  } catch {
    watchIntervals = hadExtraTime ? [[0, 120]] : [[0, 90]];
  }

  const minutes = watchIntervals.reduce((sum, [s, e]) => sum + (e - s), 0);
  const isFullMatch = minutes >= matchLength;
  const inPerson = match.watched_in_person === 1;

  // Pull coach photos from the coaches cache; the match record already carries id+name. Photos
  // ride along on the same query as the rest of the cache lookup so this stays a single hit.
  const coachIds = [match.home_coach_id, match.away_coach_id].filter(
    (id): id is number => id != null
  );
  const coachCache = getCoaches(coachIds);
  const homeCoachPhoto =
    match.home_coach_id != null ? coachCache.get(match.home_coach_id)?.photo ?? null : null;
  const awayCoachPhoto =
    match.away_coach_id != null ? coachCache.get(match.away_coach_id)?.photo ?? null : null;

  return (
    <div className="space-y-6">
      {/* Back link + delete */}
      <div className="flex items-center justify-between gap-4">
        <Link href="/" className="text-sm text-muted hover:text-accent transition-colors inline-flex items-center gap-1.5">
          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
          Back to feed
        </Link>
        <DeleteMatchButton matchId={match.id} />
      </div>

      {/* Match header — visually mirrors MatchCard from the home feed */}
      <div className={inPerson
        ? "bg-sky-500/20 rounded-xl p-6 border border-sky-400/70 space-y-5"
        : "bg-card rounded-xl p-6 border border-card-border space-y-5"
      }>
        {/* Inner block: description + teams (gap-4), matches MatchCard's nested spacing */}
        <div className="space-y-4">
          <p className="text-muted text-base">
            {isFullMatch ? "You watched the full match" : `You watched ${minutes} min`} on <span className="text-slate-300">{dateStr}</span>
            {hadExtraTime && (
              <span className="ml-2 text-[10px] uppercase tracking-wide font-semibold text-accent">
                {match.had_penalties === 1 ? "AET · Pens" : "AET"}
              </span>
            )}
            {match.had_penalties === 1 && match.watched_penalties === 1 && (
              <span className="ml-2 text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded border border-accent/40 text-accent bg-accent/10">
                + pens
              </span>
            )}
          </p>

          {/* Teams and score */}
          <div className="flex items-center gap-5">
            <TeamSide
              name={match.home_team}
              teamId={match.home_team_id}
              crest={match.home_crest}
              isWinner={match.home_score > match.away_score}
              align="left"
            />

            <div className="text-3xl font-bold text-white tabular-nums shrink-0">
              {match.home_score} - {match.away_score}
            </div>

            <TeamSide
              name={match.away_team}
              teamId={match.away_team_id}
              crest={match.away_crest}
              isWinner={match.away_score > match.home_score}
              align="right"
            />
          </div>
        </div>

        {/* Competition + round + venue + in-person */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          {match.competition && (
            match.competition_id != null ? (
              <Link
                href={`/competitions/${match.competition_id}`}
                className="inline-flex items-center gap-1.5 bg-accent-muted text-accent-dim pl-1 pr-2 py-0.5 rounded-full hover:text-accent transition-colors"
              >
                {match.competition_logo && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={match.competition_logo}
                    alt=""
                    className="w-4 h-4 object-contain bg-white/90 rounded-full p-0.5"
                  />
                )}
                {match.competition}
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1.5 bg-accent-muted text-accent-dim pl-1 pr-2 py-0.5 rounded-full">
                {match.competition_logo && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={match.competition_logo}
                    alt=""
                    className="w-4 h-4 object-contain bg-white/90 rounded-full p-0.5"
                  />
                )}
                {match.competition}
              </span>
            )
          )}
          {formatRound(match.round) && <span className="text-muted">{formatRound(match.round)}</span>}

          {(match.venue || inPerson) && (
            <div className="ml-auto inline-flex items-center gap-2">
              {match.venue && (
                <Link
                  href={
                    match.venue_id != null
                      ? `/stadiums/${match.venue_id}`
                      : `/stadiums/by-name/${encodeURIComponent(match.venue)}`
                  }
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-card-border bg-surface text-slate-200 hover:text-accent hover:border-accent/40 transition-colors"
                >
                  <StadiumIcon />
                  <span>
                    {match.venue}
                    {match.venue_city ? ` · ${match.venue_city}` : ""}
                  </span>
                </Link>
              )}
              {inPerson && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-sky-400 text-black">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                  </svg>
                  In person
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {match.home_team_id != null && match.away_team_id != null && (
        <Link
          href={`/teams/${match.home_team_id}/vs/${match.away_team_id}`}
          className="bg-card rounded-xl p-4 border border-card-border flex items-center gap-3 hover:border-accent/40 hover:text-accent transition-colors group"
        >
          <svg className="w-5 h-5 shrink-0 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12h4l3-9 4 18 3-9h4" />
          </svg>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Head-to-head</p>
            <p className="text-base font-semibold text-white group-hover:text-accent">
              All meetings between {match.home_team} and {match.away_team}
            </p>
          </div>
          <span className="text-muted text-sm shrink-0">View →</span>
        </Link>
      )}

      {/* Client-side: details + intervals */}
      <MatchDetailClient
        matchId={match.id}
        canFetchDetails={match.external_match_id !== null && match.external_source === "api-football"}
        initialIntervals={watchIntervals}
        initialWatchedInPerson={match.watched_in_person === 1}
        matchLength={matchLength}
        hadPenalties={match.had_penalties === 1}
        initialWatchedPenalties={match.watched_penalties === 1}
        homeTeam={match.home_team}
        awayTeam={match.away_team}
        homeTeamId={match.home_team_id}
        awayTeamId={match.away_team_id}
        homeCoach={
          match.home_coach_id != null && match.home_coach_name
            ? { id: match.home_coach_id, name: match.home_coach_name, photo: homeCoachPhoto }
            : null
        }
        awayCoach={
          match.away_coach_id != null && match.away_coach_name
            ? { id: match.away_coach_id, name: match.away_coach_name, photo: awayCoachPhoto }
            : null
        }
        refereeName={match.referee_name ?? null}
      />
    </div>
  );
}

function TeamSide({
  name,
  teamId,
  crest,
  isWinner,
  align,
}: {
  name: string;
  teamId: number | null;
  crest: string | null;
  isWinner: boolean;
  align: "left" | "right";
}) {
  // Mirrors MatchCard's team rendering exactly: home (align="left") pulls toward the
  // score with name-then-crest + justify-end + text-right; away (align="right") pulls
  // toward the score with crest-then-name + default flex-start.
  const wrapper =
    align === "left"
      ? "flex items-center gap-3 flex-1 min-w-0 justify-end"
      : "flex items-center gap-3 flex-1 min-w-0";
  const nameClass = `font-semibold text-xl truncate ${align === "left" ? "text-right" : ""} ${
    isWinner ? "text-accent" : "text-slate-200"
  }`;
  const crestImg = crest ? (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img src={crest} alt={name} className="w-12 h-12 object-contain shrink-0" />
  ) : null;
  const inner =
    align === "left" ? (
      <>
        <span className={nameClass}>{name}</span>
        {crestImg}
      </>
    ) : (
      <>
        {crestImg}
        <span className={nameClass}>{name}</span>
      </>
    );
  if (teamId != null) {
    return (
      <Link
        href={`/teams/${teamId}`}
        className={`${wrapper} hover:text-accent transition-colors group`}
      >
        {inner}
      </Link>
    );
  }
  return <div className={wrapper}>{inner}</div>;
}

function StadiumIcon() {
  return (
    <svg
      className="w-3.5 h-3.5 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 22s7-7.5 7-13a7 7 0 1 0-14 0c0 5.5 7 13 7 13z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  );
}
