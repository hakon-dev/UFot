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
  const rowTint = match.watchedInPerson
    ? "bg-sky-500/20 hover:bg-sky-500/30"
    : "hover:bg-surface";

  return (
    <div
      className={`
        group relative grid items-center gap-x-3 text-sm px-2 py-2.5 rounded-md transition-colors
        ${rowTint}
        ${gridCols}
      `}
    >
      {/* Whole-row click target — siblings (not children) so nested <a> is avoided.
          Team-name <Link>s get `relative` so they stack above this overlay. */}
      <Link
        href={`/matches/${match.matchId}`}
        aria-label={`${match.homeTeam} ${match.homeScore}–${match.awayScore} ${match.awayTeam}`}
        className="absolute inset-0 rounded-md"
      />

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

      {/* Score — centered, bolder. Visual only; row overlay handles the click. */}
      <span
        className="
          shrink-0 inline-flex items-center justify-center gap-1
          min-w-[3.75rem] px-2 py-0.5 rounded-md
          bg-card border border-card-border
          text-slate-100 font-semibold tabular-nums
          transition-colors group-hover:text-accent group-hover:border-accent/40
        "
      >
        <span>{match.homeScore}</span>
        <span className="text-muted font-normal">–</span>
        <span>{match.awayScore}</span>
      </span>

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

      {/* In-person pill (fixed-width column; collapses to empty when absent) */}
      <div className="flex items-center justify-center">
        {match.watchedInPerson ? (
          <span
            className="shrink-0 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-sky-400 text-black"
            title="Watched in person"
          >
            In person
          </span>
        ) : null}
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

      {/* Date — visual only; row overlay handles the click. */}
      <span className="text-xs text-muted tabular-nums text-right whitespace-nowrap transition-colors group-hover:text-accent">
        {new Date(match.date).toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "2-digit",
        })}
      </span>
    </div>
  );
}

function gridColsFor(showExtras: boolean): string {
  // The "In person" pill column is fixed-width (not `auto`) so rows with and without
  // the pill share identical column layouts; otherwise the auto column collapses to 0
  // on plain rows and team-name columns shift between rows.
  // Order: Res | Home | Score | Away | InPerson | Min | (G A Y R) | Date
  return showExtras
    ? "grid-cols-[2rem_minmax(0,1fr)_auto_minmax(0,1fr)_5.5rem_3rem_1.75rem_1.75rem_1.75rem_1.75rem_4.5rem]"
    : "grid-cols-[2rem_minmax(0,1fr)_auto_minmax(0,1fr)_5.5rem_3rem_4.5rem]";
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
      <span />
      <span className={`${cell} text-right`}>Min</span>
      {showExtras ? (
        <>
          <span className={`${cell} text-right`}>G</span>
          <span className={`${cell} text-right`}>A</span>
          <span className={`${cell} text-right`}>Y</span>
          <span className={`${cell} text-right`}>R</span>
        </>
      ) : null}
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
    // `relative` so this link stacks above the whole-row overlay link and keeps receiving clicks.
    return (
      <Link
        href={`/teams/${teamId}`}
        className={`relative truncate ${color} ${weight} ${alignCls} hover:text-accent transition-colors`}
      >
        {name}
      </Link>
    );
  }
  return <span className={`truncate ${color} ${weight} ${alignCls}`}>{name}</span>;
}
