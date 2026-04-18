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

interface PitchLineupProps {
  homeTeam: string;
  awayTeam: string;
  homeTeamId: number | null;
  awayTeamId: number | null;
  homeFormation: string | null;
  awayFormation: string | null;
  homeStarters: PitchPlayer[];
  awayStarters: PitchPlayer[];
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

function PlayerDot({
  player,
  side,
}: {
  player: PitchPlayer;
  side: "home" | "away";
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const photo =
    player.playerId != null
      ? `https://media.api-sports.io/football/players/${player.playerId}.png`
      : null;

  const accentRing = side === "home" ? "ring-accent/70" : "ring-white/40";

  const dot = (
    <div className="flex flex-col items-center gap-1 group">
      <div
        className={`relative w-11 h-11 md:w-12 md:h-12 rounded-full bg-surface ring-2 ${accentRing} overflow-hidden flex items-center justify-center group-hover:ring-accent transition-all`}
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
      </div>
      <span className="text-[10px] md:text-[11px] text-white font-medium leading-tight text-center max-w-[70px] truncate">
        {player.name.split(" ").slice(-1)[0]}
      </span>
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
}: {
  players: PitchPlayer[];
  formation: string | null;
  side: "home" | "away";
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
        // Home half occupies bottom 50%: near endline = bottom, midfield = top of home half.
        // Away half occupies top 50%: near endline = top, midfield = bottom of away half.
        const topPct =
          side === "home"
            ? 100 - rowFrac * 48 - 2
            : rowFrac * 48 + 2;

        return rowPlayers.map((p, i) => {
          const leftPct = ((i + 1) / (rowPlayers.length + 1)) * 100;
          return (
            <div
              key={`${row}-${i}-${p.name}`}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ top: `${topPct}%`, left: `${leftPct}%` }}
            >
              <PlayerDot player={p} side={side} />
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
      viewBox="0 0 100 150"
      preserveAspectRatio="none"
    >
      <rect x="0" y="0" width="100" height="150" fill="#0f2a0f" />
      <g stroke="rgba(255,255,255,0.18)" strokeWidth="0.3" fill="none">
        <rect x="2" y="2" width="96" height="146" />
        <line x1="2" y1="75" x2="98" y2="75" />
        <circle cx="50" cy="75" r="9" />
        <circle cx="50" cy="75" r="0.6" fill="rgba(255,255,255,0.4)" />
        {/* Penalty boxes */}
        <rect x="22" y="2" width="56" height="16" />
        <rect x="35" y="2" width="30" height="6" />
        <rect x="22" y="132" width="56" height="16" />
        <rect x="35" y="142" width="30" height="6" />
        {/* Penalty spots */}
        <circle cx="50" cy="13" r="0.5" fill="rgba(255,255,255,0.4)" />
        <circle cx="50" cy="137" r="0.5" fill="rgba(255,255,255,0.4)" />
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
}: PitchLineupProps) {
  return (
    <div className="space-y-3">
      {/* Team headers */}
      <div className="flex items-center justify-between text-xs">
        <TeamHeader name={awayTeam} teamId={awayTeamId} formation={awayFormation} align="left" />
        <TeamHeader name={homeTeam} teamId={homeTeamId} formation={homeFormation} align="right" />
      </div>

      {/* Pitch */}
      <div className="relative w-full rounded-xl overflow-hidden border border-card-border" style={{ aspectRatio: "2 / 3" }}>
        <PitchBackground />
        {/* Away (top half) */}
        <div className="absolute inset-x-0 top-0 h-1/2">
          <TeamHalf players={awayStarters} formation={awayFormation} side="away" />
        </div>
        {/* Home (bottom half) */}
        <div className="absolute inset-x-0 bottom-0 h-1/2">
          <TeamHalf players={homeStarters} formation={homeFormation} side="home" />
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
