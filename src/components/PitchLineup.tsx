"use client";

import Link from "next/link";
import { useState } from "react";

export interface PitchPlayer {
  playerId: number | null;
  name: string;
  shirtNumber: number | null;
  position: string | null;
  grid: string | null;
}

export interface PlayerAnnotations {
  goals: number[]; // minutes
  assists: number[]; // minutes
  yellow: number | null; // minute
  red: number | null; // minute (direct red or second yellow resolution)
  subOff: number | null; // minute
  nationality: string | null;
  countryCode: string | null;
}

interface PitchLineupProps {
  homeTeam: string;
  awayTeam: string;
  homeTeamId: number | null;
  awayTeamId: number | null;
  homeFormation: string | null;
  awayFormation: string | null;
  homeStarters: PitchPlayer[];
  awayStarters: PitchPlayer[];
  getAnnotations: (player: PitchPlayer, side: "home" | "away") => PlayerAnnotations;
}

function parseGrid(grid: string | null): { row: number; col: number } | null {
  if (!grid) return null;
  const m = grid.match(/^(\d+)[:\-](\d+)$/);
  if (!m) return null;
  return { row: parseInt(m[1], 10), col: parseInt(m[2], 10) };
}

// Distribute players who have no grid info by walking a formation like "4-2-3-1":
// GK first (row 1), then defenders, midfielders, attackers.
function assignFallbackGrid(
  players: PitchPlayer[],
  formation: string | null
): Array<PitchPlayer & { row: number; col: number }> {
  const rowsFromFormation = formation
    ? [1, ...formation.split("-").map((n) => parseInt(n, 10)).filter((n) => !isNaN(n) && n > 0)]
    : [1, 4, 3, 3];

  // Goalkeeper heuristic: position "G" or "GK".
  const sorted = [...players].sort((a, b) => {
    const aGK = a.position === "G" || a.position === "GK" ? 0 : 1;
    const bGK = b.position === "G" || b.position === "GK" ? 0 : 1;
    return aGK - bGK;
  });

  const out: Array<PitchPlayer & { row: number; col: number }> = [];
  let idx = 0;
  rowsFromFormation.forEach((count, rowIdx) => {
    for (let c = 0; c < count && idx < sorted.length; c++, idx++) {
      out.push({ ...sorted[idx], row: rowIdx + 1, col: c + 1 });
    }
  });
  while (idx < sorted.length) {
    out.push({ ...sorted[idx], row: rowsFromFormation.length, col: idx + 1 });
    idx++;
  }
  return out;
}

function withGrid(
  players: PitchPlayer[],
  formation: string | null
): Array<PitchPlayer & { row: number; col: number }> {
  const allHaveGrid = players.every((p) => parseGrid(p.grid) !== null);
  if (allHaveGrid) {
    return players.map((p) => {
      const g = parseGrid(p.grid)!;
      return { ...p, row: g.row, col: g.col };
    });
  }
  return assignFallbackGrid(players, formation);
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function CardBadge({ yellow, red }: { yellow: number | null; red: number | null }) {
  // Red always overrides yellow visually (player ended up off).
  if (red != null) {
    return (
      <span
        title={`Red card ${red}'`}
        className="absolute -top-1 -right-1 w-2.5 h-3 bg-red-500 rounded-[1px] ring-1 ring-card shadow"
      />
    );
  }
  if (yellow != null) {
    return (
      <span
        title={`Yellow card ${yellow}'`}
        className="absolute -top-1 -right-1 w-2.5 h-3 bg-yellow-400 rounded-[1px] ring-1 ring-card shadow"
      />
    );
  }
  return null;
}

function SubOffBadge({ minute }: { minute: number }) {
  return (
    <span
      title={`Subbed off ${minute}'`}
      className="absolute -top-1 -left-1 bg-red-500 text-white text-[8px] font-bold rounded-full w-4 h-4 flex items-center justify-center ring-1 ring-card leading-none"
    >
      ↓
    </span>
  );
}

function EventIcons({
  goals,
  assists,
  yellow,
  red,
  subOff,
}: {
  goals: number[];
  assists: number[];
  yellow: number | null;
  red: number | null;
  subOff: number | null;
}) {
  const hasAny =
    goals.length > 0 ||
    assists.length > 0 ||
    yellow != null ||
    red != null ||
    subOff != null;
  if (!hasAny) return null;

  return (
    <div className="flex items-center justify-center gap-0.5 flex-wrap max-w-[70px]">
      {goals.length > 0 && (
        <span className="text-[9px] text-white" title={`Goals: ${goals.join("', ")}'`}>
          ⚽{goals.length > 1 ? `×${goals.length}` : ""}
        </span>
      )}
      {assists.length > 0 && (
        <span className="text-[9px] text-accent" title={`Assists: ${assists.join("', ")}'`}>
          🅰{assists.length > 1 ? `×${assists.length}` : ""}
        </span>
      )}
      {subOff != null && (
        <span className="text-[9px] text-red-400 tabular-nums" title={`Off ${subOff}'`}>
          ↓{subOff}&apos;
        </span>
      )}
    </div>
  );
}

function PlayerDot({
  player,
  side,
  annotations,
}: {
  player: PitchPlayer;
  side: "home" | "away";
  annotations: PlayerAnnotations;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const photo =
    player.playerId != null
      ? `https://media.api-sports.io/football/players/${player.playerId}.png`
      : null;

  const accentRing = side === "home" ? "ring-accent/70" : "ring-white/40";
  const dimmed = annotations.subOff != null || annotations.red != null;

  const dot = (
    <div className="flex flex-col items-center gap-0.5 group">
      <div
        className={`relative w-10 h-10 md:w-11 md:h-11 rounded-full bg-surface ring-2 ${accentRing} overflow-hidden flex items-center justify-center group-hover:ring-accent transition-all ${
          dimmed ? "opacity-60" : ""
        }`}
      >
        {photo && !imgFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo}
            alt={player.name}
            className="w-full h-full object-cover"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <span className="text-[10px] font-bold text-muted">
            {initials(player.name)}
          </span>
        )}
        {player.shirtNumber != null && (
          <span className="absolute -bottom-0.5 -right-0.5 bg-accent text-black text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center ring-1 ring-card">
            {player.shirtNumber}
          </span>
        )}
        <CardBadge yellow={annotations.yellow} red={annotations.red} />
        {annotations.subOff != null && annotations.red == null && (
          <SubOffBadge minute={annotations.subOff} />
        )}
      </div>
      <div className="flex items-center justify-center gap-1 max-w-[80px]">
        {annotations.countryCode && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`https://flagcdn.com/${annotations.countryCode}.svg`}
            alt={annotations.nationality ?? ""}
            title={annotations.nationality ?? ""}
            className="w-3 h-2 object-cover rounded-[1px] shrink-0"
          />
        )}
        <span className="text-[10px] md:text-[11px] text-white font-medium leading-tight truncate">
          {player.name.split(" ").slice(-1)[0]}
        </span>
      </div>
      <EventIcons
        goals={annotations.goals}
        assists={annotations.assists}
        yellow={annotations.yellow}
        red={annotations.red}
        subOff={annotations.subOff}
      />
    </div>
  );

  if (player.playerId == null) return dot;
  return (
    <Link href={`/players/${player.playerId}`} className="block">
      {dot}
    </Link>
  );
}

function TeamHalf({
  players,
  formation,
  side,
  getAnnotations,
}: {
  players: PitchPlayer[];
  formation: string | null;
  side: "home" | "away";
  getAnnotations: (player: PitchPlayer, side: "home" | "away") => PlayerAnnotations;
}) {
  const placed = withGrid(players, formation);
  const maxRow = Math.max(1, ...placed.map((p) => p.row));

  // Group by row for horizontal distribution.
  const rowGroups = new Map<number, Array<PitchPlayer & { row: number; col: number }>>();
  for (const p of placed) {
    const arr = rowGroups.get(p.row) ?? [];
    arr.push(p);
    rowGroups.set(p.row, arr);
  }
  for (const arr of rowGroups.values()) {
    arr.sort((a, b) => a.col - b.col);
  }

  return (
    <div className="relative w-full h-full">
      {Array.from(rowGroups.entries()).map(([row, rowPlayers]) => {
        // Row 1 (GK) near the outer endline, higher rows toward midfield.
        const rowFrac = (row - 0.5) / (maxRow + 0.25);
        // Home half occupies left 50%: endline = left, midfield = right of home half.
        // Away half occupies right 50%: endline = right, midfield = left of away half.
        // Stretch across the full half: GK near endline (~5%), deepest row near the midline (~95%).
        const leftPct =
          side === "home"
            ? rowFrac * 90 + 5
            : 95 - rowFrac * 90;

        return rowPlayers.map((p, i) => {
          const topPct = ((i + 1) / (rowPlayers.length + 1)) * 100;
          return (
            <div
              key={`${row}-${i}-${p.name}`}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ top: `${topPct}%`, left: `${leftPct}%` }}
            >
              <PlayerDot player={p} side={side} annotations={getAnnotations(p, side)} />
            </div>
          );
        });
      })}
    </div>
  );
}

function PitchBackground() {
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox="0 0 150 100"
      preserveAspectRatio="none"
    >
      <rect x="0" y="0" width="150" height="100" fill="#0f2a0f" />
      <g stroke="rgba(255,255,255,0.18)" strokeWidth="0.3" fill="none">
        <rect x="2" y="2" width="146" height="96" />
        <line x1="75" y1="2" x2="75" y2="98" />
        <circle cx="75" cy="50" r="9" />
        <circle cx="75" cy="50" r="0.6" fill="rgba(255,255,255,0.4)" />
        {/* Left penalty box (home) */}
        <rect x="2" y="22" width="16" height="56" />
        <rect x="2" y="35" width="6" height="30" />
        {/* Right penalty box (away) */}
        <rect x="132" y="22" width="16" height="56" />
        <rect x="142" y="35" width="6" height="30" />
        {/* Penalty spots */}
        <circle cx="13" cy="50" r="0.5" fill="rgba(255,255,255,0.4)" />
        <circle cx="137" cy="50" r="0.5" fill="rgba(255,255,255,0.4)" />
      </g>
    </svg>
  );
}

export default function PitchLineup({
  homeTeam,
  awayTeam,
  homeTeamId,
  awayTeamId,
  homeFormation,
  awayFormation,
  homeStarters,
  awayStarters,
  getAnnotations,
}: PitchLineupProps) {
  return (
    <div className="space-y-3">
      {/* Team headers */}
      <div className="flex items-center justify-between text-xs">
        <TeamHeader name={homeTeam} teamId={homeTeamId} formation={homeFormation} align="left" />
        <TeamHeader name={awayTeam} teamId={awayTeamId} formation={awayFormation} align="right" />
      </div>

      {/* Pitch */}
      <div
        className="relative w-full rounded-xl overflow-hidden border border-card-border mx-auto"
        style={{ aspectRatio: "3 / 2", maxHeight: "70vh" }}
      >
        <PitchBackground />
        {/* Home (left half) */}
        <div className="absolute inset-y-0 left-0 w-1/2">
          <TeamHalf
            players={homeStarters}
            formation={homeFormation}
            side="home"
            getAnnotations={getAnnotations}
          />
        </div>
        {/* Away (right half) */}
        <div className="absolute inset-y-0 right-0 w-1/2">
          <TeamHalf
            players={awayStarters}
            formation={awayFormation}
            side="away"
            getAnnotations={getAnnotations}
          />
        </div>
      </div>
    </div>
  );
}

function TeamHeader({
  name,
  teamId,
  formation,
  align,
}: {
  name: string;
  teamId: number | null;
  formation: string | null;
  align: "left" | "right";
}) {
  const content = (
    <span className="flex items-center gap-2">
      {teamId != null && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`https://media.api-sports.io/football/teams/${teamId}.png`}
          alt={name}
          className="w-5 h-5 object-contain"
        />
      )}
      <span className="text-white font-semibold">{name}</span>
      {formation && <span className="text-muted">{formation}</span>}
    </span>
  );
  const className = `${align === "right" ? "text-right" : "text-left"} ${teamId != null ? "hover:text-accent transition-colors" : ""}`;
  if (teamId != null) {
    return (
      <Link href={`/teams/${teamId}`} className={className}>
        {content}
      </Link>
    );
  }
  return <div className={className}>{content}</div>;
}
