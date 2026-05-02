"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import WatchIntervalEditor from "@/components/WatchIntervalEditor";
import PitchLineup, { type PitchPlayer, type PlayerAnnotations } from "@/components/PitchLineup";
import { formatPosition } from "@/lib/format-position";

interface Goal {
  minute: number;
  team: string;
  scorer_name: string;
  scorer_id: number | null;
  assist_name: string | null;
  assist_id: number | null;
  type: string | null;
}

interface Substitution {
  minute: number;
  team: string;
  player_out: string;
  player_out_id: number | null;
  player_in: string;
  player_in_id: number | null;
}

interface Lineup {
  team: string;
  player_name: string;
  position: string | null;
  shirt_number: number | null;
  is_starter: number;
  player_id: number | null;
  grid_position: string | null;
}

interface Card {
  minute: number;
  team: string;
  player_name: string;
  player_id: number | null;
  card_type: string; // YELLOW / RED / YELLOWRED
}

interface NationalityEntry {
  nationality: string | null;
  countryCode: string | null;
}

interface PlayerClubEntry {
  name: string | null;
  logo: string | null;
  teamId: number | null;
}

interface MatchDetails {
  available: boolean;
  goals?: Goal[];
  substitutions?: Substitution[];
  lineups?: Lineup[];
  cards?: Card[];
  nationalities?: Record<string, NationalityEntry>;
  playerClubs?: Record<string, PlayerClubEntry>;
  homeIsNational?: boolean;
  awayIsNational?: boolean;
  homeFormation?: string | null;
  awayFormation?: string | null;
  homeTeamId?: number | null;
  awayTeamId?: number | null;
}

interface CoachProp {
  id: number;
  name: string;
  photo: string | null;
}

interface BenchAnnotations {
  goals: number[];
  assists: number[];
  yellow: number | null;
  red: number | null;
  subOn: number | null;
}

interface Props {
  matchId: string;
  canFetchDetails: boolean;
  initialIntervals: number[][];
  initialWatchedInPerson: boolean;
  matchLength: 90 | 120;
  hadPenalties: boolean;
  initialWatchedPenalties: boolean;
  homeTeam: string;
  awayTeam: string;
  homeTeamId: number | null;
  awayTeamId: number | null;
  homeCoach: CoachProp | null;
  awayCoach: CoachProp | null;
  refereeName: string | null;
}

function GoalTypeIcon({ type }: { type: string | null }) {
  if (type === "OWN_GOAL") return <span className="text-red-400 text-xs ml-1">(OG)</span>;
  if (type === "PENALTY") return <span className="text-muted text-xs ml-1">(P)</span>;
  return null;
}

function toPitchPlayer(l: Lineup): PitchPlayer {
  return {
    playerId: l.player_id,
    name: l.player_name,
    shirtNumber: l.shirt_number,
    position: l.position,
    grid: l.grid_position,
  };
}

function BenchPlayerEntry({
  player,
  annotations,
  side,
}: {
  player: Lineup;
  annotations: BenchAnnotations;
  side: "home" | "away";
}) {
  const cameOn = annotations.subOn != null;

  const chips = (
    <>
      {cameOn && (
        <span className="inline-flex items-center gap-0.5 text-green-400 text-xs shrink-0">
          <svg className="w-3 h-3 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
          </svg>
          <span className="tabular-nums">{annotations.subOn}&apos;</span>
        </span>
      )}
      {annotations.goals.map((m, i) => (
        <span key={`g${i}`} className="inline-flex items-center gap-0.5 text-xs text-slate-200 shrink-0">
          <BenchBallIcon />
          <span className="tabular-nums">{m}&apos;</span>
        </span>
      ))}
      {annotations.assists.map((m, i) => (
        <span key={`a${i}`} className="inline-flex items-center gap-0.5 text-xs text-muted shrink-0">
          <BenchBootIcon />
          <span className="tabular-nums">{m}&apos;</span>
        </span>
      ))}
      {annotations.yellow != null && (
        <span className="inline-flex items-center gap-0.5 text-xs text-muted shrink-0">
          <span className="w-2 h-2.5 rounded-[1px] bg-yellow-400 shrink-0" />
          <span className="tabular-nums">{annotations.yellow}&apos;</span>
        </span>
      )}
      {annotations.red != null && (
        <span className="inline-flex items-center gap-0.5 text-xs text-muted shrink-0">
          <span className="w-2 h-2.5 rounded-[1px] bg-red-500 shrink-0" />
          <span className="tabular-nums">{annotations.red}&apos;</span>
        </span>
      )}
    </>
  );

  const nameRow = (
    <span className={`flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm ${cameOn ? "text-slate-200" : "text-muted"}`}>
      {player.shirt_number !== null && (
        <span className="tabular-nums w-6 text-right text-muted shrink-0">{player.shirt_number}</span>
      )}
      <span className="truncate">{player.player_name}</span>
      {formatPosition(player.position) && (
        <span className="text-xs text-muted shrink-0">({formatPosition(player.position)})</span>
      )}
      {chips}
    </span>
  );

  return (
    <div className={`min-w-0 ${side === "home" ? "text-right" : "text-left"}`}>
      {player.player_id != null ? (
        <Link href={`/players/${player.player_id}`} className="block hover:text-accent transition-colors">
          {nameRow}
        </Link>
      ) : (
        nameRow
      )}
    </div>
  );
}

function BenchBallIcon() {
  return (
    <svg viewBox="0 0 16 16" className="w-3 h-3 shrink-0" aria-hidden="true">
      <circle cx="8" cy="8" r="7" fill="#ffffff" stroke="#111" strokeWidth="0.8" />
      <polygon points="8,4.2 10.8,6.2 9.7,9.5 6.3,9.5 5.2,6.2" fill="#111" />
      <path
        d="M8 1.2 L8 4.2 M14.8 8 L10.8 6.2 M1.2 8 L5.2 6.2 M4.2 14 L6.3 9.5 M11.8 14 L9.7 9.5"
        stroke="#111"
        strokeWidth="0.8"
        fill="none"
      />
    </svg>
  );
}

function BenchBootIcon() {
  return (
    <svg viewBox="0 0 16 16" className="w-3 h-3 shrink-0" aria-hidden="true">
      <path
        d="M2 9 L2 11.5 Q2 12.5 3 12.5 L13 12.5 Q14 12.5 14 11.5 L14 10.2 Q14 9.2 13 9 L9.5 8.5 Q8.5 8.3 8.2 7.5 L7 4.5 Q6.7 3.7 5.7 3.7 L4.3 3.7 Q3.3 3.7 3.3 4.7 L3.3 8.2 Q3.3 8.8 2.8 8.9 Z"
        fill="currentColor"
      />
      <circle cx="3.8" cy="13.2" r="0.6" fill="currentColor" />
      <circle cx="6.5" cy="13.2" r="0.6" fill="currentColor" />
      <circle cx="9.5" cy="13.2" r="0.6" fill="currentColor" />
      <circle cx="12.2" cy="13.2" r="0.6" fill="currentColor" />
    </svg>
  );
}

function cardLabel(type: string): string {
  if (type === "YELLOW") return "Yellow";
  if (type === "RED") return "Red";
  if (type === "YELLOWRED") return "2nd Yellow → Red";
  return type;
}

function cardColor(type: string): string {
  if (type === "YELLOW") return "bg-yellow-400";
  return "bg-red-500";
}

export default function MatchDetailClient({
  matchId,
  canFetchDetails,
  initialIntervals,
  initialWatchedInPerson,
  matchLength,
  hadPenalties,
  initialWatchedPenalties,
  homeTeam,
  awayTeam,
  homeTeamId,
  awayTeamId,
  homeCoach,
  awayCoach,
  refereeName,
}: Props) {
  const [details, setDetails] = useState<MatchDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [intervals, setIntervals] = useState(initialIntervals);
  const [watchedInPerson, setWatchedInPerson] = useState(initialWatchedInPerson);
  const [stadiumSaving, setStadiumSaving] = useState(false);
  const [watchedPenalties, setWatchedPenalties] = useState(initialWatchedPenalties);
  const [penaltiesSaving, setPenaltiesSaving] = useState(false);

  async function saveWatchedInPerson(next: boolean) {
    setWatchedInPerson(next);
    setStadiumSaving(true);
    try {
      await fetch(`/api/matches/${matchId}/stadium`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ watchedInPerson: next }),
      });
    } finally {
      setStadiumSaving(false);
    }
  }

  function handleWatchedInPersonClick(e: React.MouseEvent<HTMLInputElement>) {
    const next = !watchedInPerson;
    const message = next
      ? "Mark this match as watched in person at the stadium?"
      : "Remove the in-person stadium mark from this match?";
    if (!confirm(message)) {
      e.preventDefault();
      return;
    }
    saveWatchedInPerson(next);
  }

  async function saveWatchedPenalties(next: boolean) {
    setWatchedPenalties(next);
    setPenaltiesSaving(true);
    try {
      await fetch(`/api/matches/${matchId}/penalties`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ watchedPenalties: next }),
      });
    } finally {
      setPenaltiesSaving(false);
    }
  }

  useEffect(() => {
    if (!canFetchDetails) {
      setDetails({ available: false });
      return;
    }

    setLoading(true);
    fetch(`/api/matches/${matchId}/details`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load match details");
        setDetails(data);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load match details"))
      .finally(() => setLoading(false));
  }, [matchId, canFetchDetails]);

  const cardClass = "bg-card rounded-xl p-5 border border-card-border";

  const homeLineup = details?.lineups?.filter((l) => l.team === "home") ?? [];
  const awayLineup = details?.lineups?.filter((l) => l.team === "away") ?? [];
  const homeStarters = homeLineup.filter((l) => l.is_starter === 1);
  const awayStarters = awayLineup.filter((l) => l.is_starter === 1);

  const resolvedHomeTeamId = details?.homeTeamId ?? homeTeamId;
  const resolvedAwayTeamId = details?.awayTeamId ?? awayTeamId;

  const sortedGoals = useMemo(
    () => [...(details?.goals ?? [])].sort((a, b) => a.minute - b.minute),
    [details?.goals],
  );
  const sortedSubs = useMemo(
    () => [...(details?.substitutions ?? [])].sort((a, b) => a.minute - b.minute),
    [details?.substitutions],
  );

  // Sort bench: subbed-in players first (by sub-on minute ascending), then unused subs.
  const subOnByPlayer = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of details?.substitutions ?? []) {
      const key = s.player_in_id != null ? `id:${s.player_in_id}:${s.team}` : `name:${s.player_in}:${s.team}`;
      if (!map.has(key)) map.set(key, s.minute);
    }
    return map;
  }, [details?.substitutions]);

  function benchSubOnMinute(p: Lineup): number | null {
    const teamName = p.team === "home" ? homeTeam : awayTeam;
    const idKey = p.player_id != null ? `id:${p.player_id}:${teamName}` : null;
    const nameKey = `name:${p.player_name}:${teamName}`;
    if (idKey && subOnByPlayer.has(idKey)) return subOnByPlayer.get(idKey)!;
    if (subOnByPlayer.has(nameKey)) return subOnByPlayer.get(nameKey)!;
    return null;
  }

  function sortBench(rows: Lineup[]): Lineup[] {
    return [...rows].sort((a, b) => {
      const am = benchSubOnMinute(a);
      const bm = benchSubOnMinute(b);
      if (am != null && bm != null) return am - bm;
      if (am != null) return -1;
      if (bm != null) return 1;
      return 0;
    });
  }

  const homeBench = sortBench(homeLineup.filter((l) => l.is_starter === 0));
  const awayBench = sortBench(awayLineup.filter((l) => l.is_starter === 0));
  const sortedCards = useMemo(
    () => [...(details?.cards ?? [])].sort((a, b) => a.minute - b.minute),
    [details?.cards],
  );

  // Build a per-player annotations lookup (keyed by player_id, fallback to name).
  const getAnnotations = useMemo(() => {
    const goals = details?.goals ?? [];
    const subs = details?.substitutions ?? [];
    const cards = details?.cards ?? [];
    const nationalities = details?.nationalities ?? {};
    const playerClubs = details?.playerClubs ?? {};
    const homeIsNational = details?.homeIsNational ?? false;
    const awayIsNational = details?.awayIsNational ?? false;

    function keyFor(id: number | null, name: string): string {
      return id != null ? `id:${id}` : `name:${name}`;
    }

    return (player: PitchPlayer, side: "home" | "away"): PlayerAnnotations => {
      const playerKey = keyFor(player.playerId, player.name);
      const teamName = side === "home" ? homeTeam : awayTeam;

      const scored: number[] = [];
      const assisted: number[] = [];
      for (const g of goals) {
        if (g.team !== teamName && g.type !== "OWN_GOAL") {
          // Goal scored by opposing team — could still be an own goal counted to the other side (rare, skip).
          continue;
        }
        if (keyFor(g.scorer_id, g.scorer_name) === playerKey && g.type !== "OWN_GOAL") {
          scored.push(g.minute);
        }
        if (g.assist_name && keyFor(g.assist_id, g.assist_name) === playerKey) {
          assisted.push(g.minute);
        }
      }

      let yellow: number | null = null;
      let red: number | null = null;
      for (const c of cards) {
        if (c.team !== teamName) continue;
        if (keyFor(c.player_id, c.player_name) !== playerKey) continue;
        if (c.card_type === "YELLOW") yellow = yellow ?? c.minute;
        else if (c.card_type === "RED" || c.card_type === "YELLOWRED") red = c.minute;
      }

      let subOff: number | null = null;
      for (const s of subs) {
        if (s.team !== teamName) continue;
        if (keyFor(s.player_out_id, s.player_out) === playerKey) {
          subOff = s.minute;
          break;
        }
      }

      const sideIsNational = side === "home" ? homeIsNational : awayIsNational;
      const clubEntry =
        sideIsNational && player.playerId != null
          ? playerClubs[String(player.playerId)]
          : undefined;

      const nationalityEntry =
        player.playerId != null ? nationalities[String(player.playerId)] : undefined;

      // On national-team sides, hide the (redundant) nationality flag — the club takes that slot.
      const nationality = sideIsNational ? null : nationalityEntry?.nationality ?? null;
      const countryCode = sideIsNational ? null : nationalityEntry?.countryCode ?? null;

      return {
        goals: scored,
        assists: assisted,
        yellow,
        red,
        subOff,
        nationality,
        countryCode,
        clubName: clubEntry?.name ?? null,
        clubLogo: clubEntry?.logo ?? null,
        clubId: clubEntry?.teamId ?? null,
      };
    };
  }, [details, homeTeam, awayTeam]);

  const getBenchAnnotations = useMemo(() => {
    const goals = details?.goals ?? [];
    const subs = details?.substitutions ?? [];
    const cards = details?.cards ?? [];

    function keyFor(id: number | null, name: string): string {
      return id != null ? `id:${id}` : `name:${name}`;
    }

    return (player: Lineup, side: "home" | "away"): BenchAnnotations => {
      const playerKey = keyFor(player.player_id, player.player_name);
      const teamName = side === "home" ? homeTeam : awayTeam;

      const scored: number[] = [];
      const assisted: number[] = [];
      for (const g of goals) {
        if (g.team !== teamName && g.type !== "OWN_GOAL") continue;
        if (keyFor(g.scorer_id, g.scorer_name) === playerKey && g.type !== "OWN_GOAL") {
          scored.push(g.minute);
        }
        if (g.assist_name && keyFor(g.assist_id, g.assist_name) === playerKey) {
          assisted.push(g.minute);
        }
      }

      let yellow: number | null = null;
      let red: number | null = null;
      for (const c of cards) {
        if (c.team !== teamName) continue;
        if (keyFor(c.player_id, c.player_name) !== playerKey) continue;
        if (c.card_type === "YELLOW") yellow = yellow ?? c.minute;
        else if (c.card_type === "RED" || c.card_type === "YELLOWRED") red = c.minute;
      }

      let subOn: number | null = null;
      for (const s of subs) {
        if (s.team !== teamName) continue;
        if (keyFor(s.player_in_id, s.player_in) === playerKey) {
          subOn = s.minute;
          break;
        }
      }

      return { goals: scored, assists: assisted, yellow, red, subOn };
    };
  }, [details, homeTeam, awayTeam]);

  return (
    <div className="space-y-6">
      {/* Watch Intervals */}
      <div className={cardClass}>
        <h2 className="text-lg font-semibold text-white mb-4">Watch Intervals</h2>
        <WatchIntervalEditor
          intervals={intervals}
          onChange={setIntervals}
          matchId={matchId}
          matchLength={matchLength}
        />
        {hadPenalties && (
          <label className="flex items-center gap-2.5 mt-4 text-sm text-slate-200 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={watchedPenalties}
              onChange={(e) => saveWatchedPenalties(e.target.checked)}
              disabled={penaltiesSaving}
              className="w-4 h-4 rounded border-card-border bg-surface accent-accent"
            />
            Watched the penalty shootout
          </label>
        )}
        <label className="flex items-center gap-2.5 mt-4 text-sm text-slate-200 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={watchedInPerson}
            onChange={() => {}}
            onClick={handleWatchedInPersonClick}
            disabled={stadiumSaving}
            className="w-4 h-4 rounded border-card-border bg-surface accent-accent"
          />
          Watched in person at the stadium
        </label>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center gap-3 text-muted py-8">
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading match details...
        </div>
      )}

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {details && !details.available && (
        <div className={cardClass}>
          <p className="text-muted text-sm">
            Match details are not available for manually added matches or legacy entries.
          </p>
        </div>
      )}

      {details?.available && details.goals?.length === 0 && details.lineups?.length === 0 && (
        <div className={cardClass}>
          <p className="text-muted text-sm">
            Detailed match data (lineups, goals, substitutions) is not available for this match.
          </p>
        </div>
      )}

      {details?.available && (
        <>
          {/* Goals — chronological, home left / away right */}
          {sortedGoals.length > 0 && (
            <div className={cardClass}>
              <h2 className="text-lg font-semibold text-white mb-4">Goals</h2>
              <TeamHeaderRow
                homeTeam={homeTeam}
                homeTeamId={resolvedHomeTeamId ?? null}
                awayTeam={awayTeam}
                awayTeamId={resolvedAwayTeamId ?? null}
              />
              <div className="space-y-2 mt-3">
                {sortedGoals.map((goal, i) => {
                  const isHome = goal.team === homeTeam;
                  return (
                    <EventRow key={i} minute={goal.minute} isHome={isHome}>
                      <div className={`text-sm min-w-0 ${isHome ? "text-right" : "text-left"}`}>
                        <div>
                          <PlayerName id={goal.scorer_id} name={goal.scorer_name} className="text-white font-medium" />
                          <GoalTypeIcon type={goal.type} />
                        </div>
                        {goal.assist_name && (
                          <div className="text-muted text-xs">
                            assist: <PlayerName id={goal.assist_id} name={goal.assist_name} className="text-muted" inline />
                          </div>
                        )}
                      </div>
                    </EventRow>
                  );
                })}
              </div>
            </div>
          )}

          {/* Lineups — pitch with coaches below */}
          {homeStarters.length > 0 && awayStarters.length > 0 && (
            <div className={cardClass}>
              <h2 className="text-lg font-semibold text-white mb-4">Lineups</h2>
              <PitchLineup
                homeTeam={homeTeam}
                awayTeam={awayTeam}
                homeTeamId={resolvedHomeTeamId ?? null}
                awayTeamId={resolvedAwayTeamId ?? null}
                homeFormation={details.homeFormation ?? null}
                awayFormation={details.awayFormation ?? null}
                homeStarters={homeStarters.map(toPitchPlayer)}
                awayStarters={awayStarters.map(toPitchPlayer)}
                getAnnotations={getAnnotations}
              />
              {(homeCoach || awayCoach || refereeName) && (
                <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-card-border/50 items-center">
                  <CoachBadge coach={homeCoach} align="left" />
                  <RefereeBadge name={refereeName} />
                  <CoachBadge coach={awayCoach} align="right" />
                </div>
              )}
            </div>
          )}

          {/* Substitutions — chronological, home left / away right */}
          {sortedSubs.length > 0 && (
            <div className={cardClass}>
              <h2 className="text-lg font-semibold text-white mb-4">Substitutions</h2>
              <TeamHeaderRow
                homeTeam={homeTeam}
                homeTeamId={resolvedHomeTeamId ?? null}
                awayTeam={awayTeam}
                awayTeamId={resolvedAwayTeamId ?? null}
              />
              <div className="space-y-2 mt-3">
                {sortedSubs.map((sub, i) => {
                  const isHome = sub.team === homeTeam;
                  return (
                    <EventRow key={i} minute={sub.minute} isHome={isHome}>
                      <div className="text-sm min-w-0">
                        <div className={`flex items-center gap-1.5 text-green-400 ${isHome ? "justify-end" : "justify-start"}`}>
                          <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                          </svg>
                          <PlayerName id={sub.player_in_id} name={sub.player_in} className="text-green-400 truncate" />
                        </div>
                        <div className={`flex items-center gap-1.5 text-red-400 ${isHome ? "justify-end" : "justify-start"}`}>
                          <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 12.586V5a1 1 0 012 0v7.586l2.293-2.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          <PlayerName id={sub.player_out_id} name={sub.player_out} className="text-red-400 truncate" />
                        </div>
                      </div>
                    </EventRow>
                  );
                })}
              </div>
            </div>
          )}

          {/* Cards — chronological, home left / away right */}
          {sortedCards.length > 0 && (
            <div className={cardClass}>
              <h2 className="text-lg font-semibold text-white mb-4">Cards</h2>
              <TeamHeaderRow
                homeTeam={homeTeam}
                homeTeamId={resolvedHomeTeamId ?? null}
                awayTeam={awayTeam}
                awayTeamId={resolvedAwayTeamId ?? null}
              />
              <div className="space-y-2 mt-3">
                {sortedCards.map((c, i) => {
                  const isHome = c.team === homeTeam;
                  const inner = (
                    <span className={`flex items-center gap-2 text-sm ${isHome ? "justify-end" : "justify-start"}`}>
                      <span className={`w-2.5 h-3.5 rounded-[1px] shrink-0 ${cardColor(c.card_type)}`} />
                      <span className="text-slate-200 truncate">{c.player_name}</span>
                      <span className="text-muted text-xs">({cardLabel(c.card_type)})</span>
                    </span>
                  );
                  return (
                    <EventRow key={i} minute={c.minute} isHome={isHome}>
                      {c.player_id != null ? (
                        <Link href={`/players/${c.player_id}`} className="hover:text-accent transition-colors block min-w-0">
                          {inner}
                        </Link>
                      ) : (
                        <div className="min-w-0">{inner}</div>
                      )}
                    </EventRow>
                  );
                })}
              </div>
            </div>
          )}

          {/* Benches — same chronological-style layout as Goals/Subs/Cards, with home left / away right */}
          {(homeBench.length > 0 || awayBench.length > 0) && (
            <div className={cardClass}>
              <h2 className="text-lg font-semibold text-white mb-4">Benches</h2>
              <TeamHeaderRow
                homeTeam={homeTeam}
                homeTeamId={resolvedHomeTeamId ?? null}
                awayTeam={awayTeam}
                awayTeamId={resolvedAwayTeamId ?? null}
              />
              <div className="space-y-2 mt-3">
                {Array.from({ length: Math.max(homeBench.length, awayBench.length) }).map((_, i) => {
                  const home = homeBench[i] ?? null;
                  const away = awayBench[i] ?? null;
                  return (
                    <div key={i} className="grid grid-cols-[1fr_auto_1fr] items-start gap-3">
                      <div className="min-w-0 flex justify-end">
                        {home && <BenchPlayerEntry player={home} annotations={getBenchAnnotations(home, "home")} side="home" />}
                      </div>
                      <span className="w-10" />
                      <div className="min-w-0 flex justify-start">
                        {away && <BenchPlayerEntry player={away} annotations={getBenchAnnotations(away, "away")} side="away" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function CoachBadge({ coach, align }: { coach: CoachProp | null; align: "left" | "right" }) {
  // Empty placeholder keeps both halves of the grid the same width even when only one team's
  // coach is known (lineups can come back with coach info on one side and not the other).
  if (!coach) return <div />;

  const initials = coach.name
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const avatar = coach.photo ? (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={coach.photo}
      alt={coach.name}
      className="w-8 h-8 rounded-full object-cover bg-surface ring-1 ring-card-border shrink-0"
    />
  ) : (
    <div className="w-8 h-8 rounded-full bg-surface ring-1 ring-card-border flex items-center justify-center shrink-0">
      <span className="text-[10px] font-bold text-muted">{initials || "?"}</span>
    </div>
  );

  const text = (
    <div className={`min-w-0 ${align === "right" ? "text-right" : "text-left"}`}>
      <p className="text-[10px] uppercase tracking-wide text-muted leading-tight">Coach</p>
      <p className="text-sm text-slate-200 truncate">{coach.name}</p>
    </div>
  );

  return (
    <Link
      href={`/coaches/${coach.id}`}
      className={`flex items-center gap-2 min-w-0 hover:text-accent transition-colors ${
        align === "right" ? "justify-end" : ""
      }`}
    >
      {align === "left" ? (
        <>
          {avatar}
          {text}
        </>
      ) : (
        <>
          {text}
          {avatar}
        </>
      )}
    </Link>
  );
}

function RefereeBadge({ name }: { name: string | null }) {
  // Empty cell keeps the 3-col grid balanced when the referee is unknown.
  if (!name) return <div />;
  return (
    <Link
      href={`/referees/${encodeURIComponent(name)}`}
      className="flex flex-col items-center gap-1 min-w-0 hover:text-accent transition-colors text-center"
    >
      <p className="text-[10px] uppercase tracking-wide text-muted leading-tight">Referee</p>
      <span className="inline-flex items-center gap-1.5 text-sm text-slate-200 truncate">
        <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
        <span className="truncate">{name}</span>
      </span>
    </Link>
  );
}

function PlayerName({
  id,
  name,
  className,
  inline,
}: {
  id: number | null;
  name: string;
  className?: string;
  inline?: boolean;
}) {
  const Tag = inline ? "span" : "span";
  if (id != null) {
    return (
      <Link href={`/players/${id}`} className={`hover:text-accent transition-colors ${className ?? ""}`}>
        {name}
      </Link>
    );
  }
  return <Tag className={className}>{name}</Tag>;
}

function EventRow({
  minute,
  isHome,
  children,
}: {
  minute: number;
  isHome: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
      <div className={`min-w-0 flex ${isHome ? "justify-end" : ""}`}>
        {isHome && children}
      </div>
      <span className="tabular-nums font-bold text-sm w-10 text-center text-accent">
        {minute}&apos;
      </span>
      <div className={`min-w-0 flex ${!isHome ? "justify-start" : ""}`}>
        {!isHome && children}
      </div>
    </div>
  );
}

function TeamHeaderRow({
  homeTeam,
  homeTeamId,
  awayTeam,
  awayTeamId,
}: {
  homeTeam: string;
  homeTeamId: number | null;
  awayTeam: string;
  awayTeamId: number | null;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 pb-3 border-b border-card-border/50">
      <div className="flex justify-end min-w-0">
        <TeamLink teamName={homeTeam} teamId={homeTeamId} crestSide="right" />
      </div>
      <span className="w-10" />
      <div className="flex justify-start min-w-0">
        <TeamLink teamName={awayTeam} teamId={awayTeamId} crestSide="left" />
      </div>
    </div>
  );
}

function TeamLink({
  teamName,
  teamId,
  crestSide,
}: {
  teamName: string;
  teamId: number | null;
  crestSide: "left" | "right";
}) {
  const crest =
    teamId != null ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`https://media.api-sports.io/football/teams/${teamId}.png`}
        alt={teamName}
        className="w-7 h-7 object-contain shrink-0"
      />
    ) : null;
  const label = <span className="text-base font-semibold text-accent truncate">{teamName}</span>;
  const inner = crestSide === "left" ? (<>{crest}{label}</>) : (<>{label}{crest}</>);
  const cls = "flex items-center gap-2 min-w-0";
  if (teamId != null) {
    return (
      <Link href={`/teams/${teamId}`} className={`${cls} hover:opacity-80 transition-opacity`}>
        {inner}
      </Link>
    );
  }
  return <div className={cls}>{inner}</div>;
}
