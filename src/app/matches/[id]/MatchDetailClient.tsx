"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import WatchIntervalEditor from "@/components/WatchIntervalEditor";
import PitchLineup, { type PitchPlayer } from "@/components/PitchLineup";

interface Goal {
  minute: number;
  team: string;
  scorer_name: string;
  assist_name: string | null;
  type: string | null;
}

interface Substitution {
  minute: number;
  team: string;
  player_out: string;
  player_in: string;
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

interface MatchDetails {
  available: boolean;
  goals?: Goal[];
  substitutions?: Substitution[];
  lineups?: Lineup[];
  homeFormation?: string | null;
  awayFormation?: string | null;
  homeTeamId?: number | null;
  awayTeamId?: number | null;
}

interface Props {
  matchId: string;
  canFetchDetails: boolean;
  initialIntervals: number[][];
  homeTeam: string;
  awayTeam: string;
  homeTeamId: number | null;
  awayTeamId: number | null;
}

function GoalTypeIcon({ type }: { type: string | null }) {
  if (type === "OWN_GOAL") return <span className="text-red-400 text-xs">(OG)</span>;
  if (type === "PENALTY") return <span className="text-muted text-xs">(P)</span>;
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

function BenchList({
  players,
  label,
}: {
  players: Lineup[];
  label: string;
}) {
  if (players.length === 0) return null;
  return (
    <div>
      <p className="text-xs text-muted mb-2">{label}</p>
      <div className="space-y-1">
        {players.map((p, i) => {
          const content = (
            <span className="flex items-center gap-2 text-sm text-muted">
              {p.shirt_number !== null && (
                <span className="tabular-nums w-6 text-right">{p.shirt_number}</span>
              )}
              <span>{p.player_name}</span>
              {p.position && <span className="text-xs">({p.position})</span>}
            </span>
          );
          return p.player_id != null ? (
            <Link key={i} href={`/players/${p.player_id}`} className="block hover:text-accent transition-colors">
              {content}
            </Link>
          ) : (
            <div key={i}>{content}</div>
          );
        })}
      </div>
    </div>
  );
}

export default function MatchDetailClient({
  matchId,
  canFetchDetails,
  initialIntervals,
  homeTeam,
  awayTeam,
  homeTeamId,
  awayTeamId,
}: Props) {
  const [details, setDetails] = useState<MatchDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [intervals, setIntervals] = useState(initialIntervals);

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
  const homeBench = homeLineup.filter((l) => l.is_starter === 0);
  const awayStarters = awayLineup.filter((l) => l.is_starter === 1);
  const awayBench = awayLineup.filter((l) => l.is_starter === 0);

  const resolvedHomeTeamId = details?.homeTeamId ?? homeTeamId;
  const resolvedAwayTeamId = details?.awayTeamId ?? awayTeamId;

  const homeSubs = details?.substitutions?.filter((s) => s.team === homeTeam) ?? [];
  const awaySubs = details?.substitutions?.filter((s) => s.team === awayTeam) ?? [];

  return (
    <div className="space-y-6">
      {/* Watch Intervals */}
      <div className={cardClass}>
        <h2 className="text-lg font-semibold text-white mb-4">Watch Intervals</h2>
        <WatchIntervalEditor
          intervals={intervals}
          onChange={setIntervals}
          matchId={matchId}
        />
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
          {/* Goals */}
          {details.goals && details.goals.length > 0 && (
            <div className={cardClass}>
              <h2 className="text-lg font-semibold text-white mb-4">Goals</h2>
              <div className="space-y-2">
                {details.goals.map((goal, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm">
                    <span className="text-accent font-bold tabular-nums w-8 text-right">{goal.minute}&apos;</span>
                    <div className="flex-1">
                      <span className="text-white font-medium">{goal.scorer_name}</span>
                      {goal.assist_name && (
                        <span className="text-muted ml-1.5">(assist: {goal.assist_name})</span>
                      )}
                      <GoalTypeIcon type={goal.type} />
                    </div>
                    <span className="text-muted text-xs">{goal.team}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Lineups — pitch */}
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
              />
            </div>
          )}

          {/* Substitutions — two columns, one team each */}
          {details.substitutions && details.substitutions.length > 0 && (
            <div className={cardClass}>
              <h2 className="text-lg font-semibold text-white mb-4">Substitutions</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <SubColumn teamName={homeTeam} teamId={resolvedHomeTeamId ?? null} subs={homeSubs} />
                <SubColumn teamName={awayTeam} teamId={resolvedAwayTeamId ?? null} subs={awaySubs} />
              </div>
            </div>
          )}

          {/* Benches */}
          {(homeBench.length > 0 || awayBench.length > 0) && (
            <div className={cardClass}>
              <h2 className="text-lg font-semibold text-white mb-4">Benches</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <BenchList players={homeBench} label={homeTeam} />
                <BenchList players={awayBench} label={awayTeam} />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SubColumn({
  teamName,
  teamId,
  subs,
}: {
  teamName: string;
  teamId: number | null;
  subs: Substitution[];
}) {
  const header = (
    <h3 className="text-sm font-semibold text-accent mb-3 flex items-center gap-2">
      {teamId != null && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`https://media.api-sports.io/football/teams/${teamId}.png`}
          alt={teamName}
          className="w-5 h-5 object-contain"
        />
      )}
      {teamName}
    </h3>
  );
  return (
    <div>
      {teamId != null ? (
        <Link href={`/teams/${teamId}`} className="hover:text-accent transition-colors block">
          {header}
        </Link>
      ) : (
        header
      )}
      {subs.length === 0 ? (
        <p className="text-muted text-sm">No substitutions</p>
      ) : (
        <div className="space-y-2">
          {subs.map((sub, i) => (
            <div key={i} className="flex items-center gap-3 text-sm">
              <span className="text-muted font-bold tabular-nums w-8 text-right">{sub.minute}&apos;</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 text-green-400">
                  <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                  <span className="truncate">{sub.player_in}</span>
                </div>
                <div className="flex items-center gap-1.5 text-red-400">
                  <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 12.586V5a1 1 0 012 0v7.586l2.293-2.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span className="truncate">{sub.player_out}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
