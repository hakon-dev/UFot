import Link from "next/link";

export interface WatchedMatchRowData {
  matchId: string;
  date: string;
  homeTeam: string;
  homeTeamId: number | null;
  homeCrest: string | null;
  homeScore: number;
  awayTeam: string;
  awayTeamId: number | null;
  awayCrest: string | null;
  awayScore: number;
  minutesWatched: number;
  watchedInPerson?: boolean;
}

export type Perspective =
  | { kind: "neutral" }
  | { kind: "team"; teamId: number }
  | { kind: "player"; teamId: number | null };

export interface WatchedMatchRowExtras {
  goals?: number;
  assists?: number;
  yellows?: number;
  reds?: number;
}

// A shared row used by Matches Watched (team page) and Appearances (player page), plus
// competition / country / stadium pages. Keeps all those lists visually symmetrical.
//
// `showExtras` reserves four fixed-width columns for G / A / Y / R so values line up
// vertically across rows (empty cells render as a muted dash). When false, those
// columns collapse entirely.
export default function WatchedMatchRow({
  match,
  perspective,
  extras,
  showExtras = false,
}: {
  match: WatchedMatchRowData;
  perspective: Perspective;
  extras?: WatchedMatchRowExtras;
  showExtras?: boolean;
}) {
  const sideTeamId =
    perspective.kind === "team"
      ? perspective.teamId
      : perspective.kind === "player"
      ? perspective.teamId
      : null;

  let resultLetter: "W" | "D" | "L" | null = null;
  let resultColor = "text-slate-400";
  if (sideTeamId != null && match.homeTeamId != null && match.awayTeamId != null) {
    const isHome = sideTeamId === match.homeTeamId;
    const isAway = sideTeamId === match.awayTeamId;
    if (isHome || isAway) {
      const my = isHome ? match.homeScore : match.awayScore;
      const theirs = isHome ? match.awayScore : match.homeScore;
      if (my > theirs) {
        resultLetter = "W";
        resultColor = "text-accent";
      } else if (my < theirs) {
        resultLetter = "L";
        resultColor = "text-red-400";
      } else {
        resultLetter = "D";
        resultColor = "text-slate-300";
      }
    }
  }

  const highlightSide: "home" | "away" | null =
    sideTeamId != null && match.homeTeamId === sideTeamId
      ? "home"
      : sideTeamId != null && match.awayTeamId === sideTeamId
      ? "away"
      : null;

  const gridCols = gridColsFor(showExtras);

  return (
    <div
      className={`
        grid items-center gap-x-3 text-sm px-2 py-2.5 transition-colors
        hover:bg-surface
        ${gridCols}
      `}
    >
      {/* Result */}
      <span className={`text-center font-bold tabular-nums ${resultColor}`}>
        {resultLetter ?? "–"}
      </span>

      {/* Home team — right aligned so the crest sits next to the score */}
      <div className="flex items-center justify-end gap-2 min-w-0">
        <TeamNameLink
          teamId={match.homeTeamId}
          name={match.homeTeam}
          highlight={highlightSide === "home"}
          align="right"
        />
        {match.homeCrest ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={match.homeCrest}
            alt={match.homeTeam}
            className="w-5 h-5 object-contain shrink-0"
          />
        ) : (
          <span className="w-5 h-5 shrink-0" />
        )}
      </div>

      {/* Score — centered, bolder */}
      <Link
        href={`/matches/${match.matchId}`}
        className="
          shrink-0 inline-flex items-center justify-center gap-1
          min-w-[3.75rem] px-2 py-0.5 rounded-md
          bg-card border border-card-border
          text-slate-100 font-semibold tabular-nums
          hover:text-accent hover:border-accent/40 transition-colors
        "
      >
        <span>{match.homeScore}</span>
        <span className="text-muted font-normal">–</span>
        <span>{match.awayScore}</span>
      </Link>

      {/* Away team — left aligned so the crest sits next to the score */}
      <div className="flex items-center gap-2 min-w-0">
        {match.awayCrest ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={match.awayCrest}
            alt={match.awayTeam}
            className="w-5 h-5 object-contain shrink-0"
          />
        ) : (
          <span className="w-5 h-5 shrink-0" />
        )}
        <TeamNameLink
          teamId={match.awayTeamId}
          name={match.awayTeam}
          highlight={highlightSide === "away"}
          align="left"
        />
      </div>

      {/* Minutes */}
      <span className="text-xs text-muted tabular-nums text-right">
        {match.minutesWatched}′
      </span>

      {/* G / A / Y / R — one column each, only when any row in the list has extras */}
      {showExtras ? (
        <>
          <StatCell value={extras?.goals} suffix="G" tone="accent" />
          <StatCell value={extras?.assists} suffix="A" tone="muted" />
          <StatCell value={extras?.yellows} suffix="Y" tone="yellow" />
          <StatCell value={extras?.reds} suffix="R" tone="red" />
        </>
      ) : null}

      {/* In-person pill (collapses when absent) */}
      <div className="flex items-center justify-end">
        {match.watchedInPerson ? (
          <span
            className="shrink-0 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded border border-accent/40 text-accent bg-accent/10"
            title="Watched in person"
          >
            In person
          </span>
        ) : null}
      </div>

      {/* Date */}
      <Link
        href={`/matches/${match.matchId}`}
        className="text-xs text-muted tabular-nums text-right hover:text-accent transition-colors whitespace-nowrap"
      >
        {new Date(match.date).toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "2-digit",
        })}
      </Link>
    </div>
  );
}

function gridColsFor(showExtras: boolean): string {
  return showExtras
    ? "grid-cols-[2rem_minmax(0,1fr)_auto_minmax(0,1fr)_3rem_1.75rem_1.75rem_1.75rem_1.75rem_auto_4.5rem]"
    : "grid-cols-[2rem_minmax(0,1fr)_auto_minmax(0,1fr)_3rem_auto_4.5rem]";
}

export function WatchedMatchRowHeader({ showExtras = false }: { showExtras?: boolean }) {
  const gridCols = gridColsFor(showExtras);
  const cell =
    "text-[10px] font-semibold uppercase tracking-wider text-muted/80";
  return (
    <div
      className={`
        grid items-center gap-x-3 px-2 py-2
        bg-card/60
        ${gridCols}
      `}
    >
      <span className={`${cell} text-center`}>Res</span>
      <span className={`${cell} text-right`}>Home</span>
      <span />
      <span className={`${cell} text-left`}>Away</span>
      <span className={`${cell} text-right`}>Min</span>
      {showExtras ? (
        <>
          <span className={`${cell} text-right`}>G</span>
          <span className={`${cell} text-right`}>A</span>
          <span className={`${cell} text-right`}>Y</span>
          <span className={`${cell} text-right`}>R</span>
        </>
      ) : null}
      <span />
      <span className={`${cell} text-right`}>Date</span>
    </div>
  );
}

function StatCell({
  value,
  suffix,
  tone,
}: {
  value: number | undefined;
  suffix: string;
  tone: "accent" | "muted" | "yellow" | "red";
}) {
  if (!value) {
    return <span className="text-xs text-muted/50 tabular-nums text-right">–</span>;
  }
  const color =
    tone === "accent"
      ? "text-accent"
      : tone === "yellow"
      ? "text-yellow-400"
      : tone === "red"
      ? "text-red-400"
      : "text-slate-300";
  return (
    <span className={`text-xs tabular-nums font-medium text-right ${color}`}>
      {value}
      {suffix}
    </span>
  );
}

function TeamNameLink({
  teamId,
  name,
  highlight,
  align,
}: {
  teamId: number | null;
  name: string;
  highlight: boolean;
  align: "left" | "right";
}) {
  const weight = highlight ? "font-semibold" : "font-normal";
  const color = highlight ? "text-accent" : "text-slate-200";
  const alignCls = align === "right" ? "text-right" : "text-left";
  if (teamId != null) {
    return (
      <Link
        href={`/teams/${teamId}`}
        className={`truncate ${color} ${weight} ${alignCls} hover:text-accent transition-colors`}
      >
        {name}
      </Link>
    );
  }
  return <span className={`truncate ${color} ${weight} ${alignCls}`}>{name}</span>;
}
