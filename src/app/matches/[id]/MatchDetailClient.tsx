"use client";

import { useEffect, useState } from "react";
import WatchIntervalEditor from "@/components/WatchIntervalEditor";

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
}

interface MatchDetails {
  available: boolean;
  goals?: Goal[];
  substitutions?: Substitution[];
  lineups?: Lineup[];
}

interface Props {
  matchId: string;
  hasFootballDataId: boolean;
  initialIntervals: number[][];
  homeTeam: string;
  awayTeam: string;
}

function GoalTypeIcon({ type }: { type: string | null }) {
  if (type === "OWN_GOAL") return <span className="text-red-400 text-xs">(OG)</span>;
  if (type === "PENALTY") return <span className="text-muted text-xs">(P)</span>;
  return null;
}

export default function MatchDetailClient({ matchId, hasFootballDataId, initialIntervals, homeTeam, awayTeam }: Props) {
  const [details, setDetails] = useState<MatchDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [intervals, setIntervals] = useState(initialIntervals);

  useEffect(() => {
    if (!hasFootballDataId) {
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
  }, [matchId, hasFootballDataId]);

  const cardClass = "bg-card rounded-xl p-5 border border-card-border";

  const homeLineup = details?.lineups?.filter((l) => l.team === "home") ?? [];
  const awayLineup = details?.lineups?.filter((l) => l.team === "away") ?? [];
  const homeStarters = homeLineup.filter((l) => l.is_starter === 1);
  const homeBench = homeLineup.filter((l) => l.is_starter === 0);
  const awayStarters = awayLineup.filter((l) => l.is_starter === 1);
  const awayBench = awayLineup.filter((l) => l.is_starter === 0);

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
            Match details are not available for manually added matches.
          </p>
        </div>
      )}

      {details?.available && details.goals?.length === 0 && details.lineups?.length === 0 && (
        <div className={cardClass}>
          <p className="text-muted text-sm">
            Detailed match data (lineups, goals, substitutions) is not available on the free football-data.org API tier.
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

          {/* Substitutions */}
          {details.substitutions && details.substitutions.length > 0 && (
            <div className={cardClass}>
              <h2 className="text-lg font-semibold text-white mb-4">Substitutions</h2>
              <div className="space-y-2">
                {details.substitutions.map((sub, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm">
                    <span className="text-muted font-bold tabular-nums w-8 text-right">{sub.minute}&apos;</span>
                    <div className="flex-1 flex items-center gap-2">
                      <span className="text-green-400">
                        <svg className="w-3.5 h-3.5 inline" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                        {sub.player_in}
                      </span>
                      <span className="text-red-400">
                        <svg className="w-3.5 h-3.5 inline" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 12.586V5a1 1 0 012 0v7.586l2.293-2.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        {sub.player_out}
                      </span>
                    </div>
                    <span className="text-muted text-xs">{sub.team}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Lineups */}
          {details.lineups && details.lineups.length > 0 && (
            <div className={cardClass}>
              <h2 className="text-lg font-semibold text-white mb-4">Lineups</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Home */}
                <div>
                  <h3 className="text-sm font-semibold text-accent mb-3">{homeTeam}</h3>
                  <div className="space-y-1">
                    {homeStarters.map((p, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        {p.shirt_number !== null && (
                          <span className="text-muted tabular-nums w-6 text-right">{p.shirt_number}</span>
                        )}
                        <span className="text-white">{p.player_name}</span>
                        {p.position && <span className="text-muted text-xs">({p.position})</span>}
                      </div>
                    ))}
                  </div>
                  {homeBench.length > 0 && (
                    <>
                      <p className="text-xs text-muted mt-3 mb-1.5">Bench</p>
                      <div className="space-y-1">
                        {homeBench.map((p, i) => (
                          <div key={i} className="flex items-center gap-2 text-sm text-muted">
                            {p.shirt_number !== null && (
                              <span className="tabular-nums w-6 text-right">{p.shirt_number}</span>
                            )}
                            <span>{p.player_name}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {/* Away */}
                <div>
                  <h3 className="text-sm font-semibold text-accent mb-3">{awayTeam}</h3>
                  <div className="space-y-1">
                    {awayStarters.map((p, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        {p.shirt_number !== null && (
                          <span className="text-muted tabular-nums w-6 text-right">{p.shirt_number}</span>
                        )}
                        <span className="text-white">{p.player_name}</span>
                        {p.position && <span className="text-muted text-xs">({p.position})</span>}
                      </div>
                    ))}
                  </div>
                  {awayBench.length > 0 && (
                    <>
                      <p className="text-xs text-muted mt-3 mb-1.5">Bench</p>
                      <div className="space-y-1">
                        {awayBench.map((p, i) => (
                          <div key={i} className="flex items-center gap-2 text-sm text-muted">
                            {p.shirt_number !== null && (
                              <span className="tabular-nums w-6 text-right">{p.shirt_number}</span>
                            )}
                            <span>{p.player_name}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
