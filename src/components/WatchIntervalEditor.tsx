"use client";

import { useState } from "react";

interface WatchIntervalEditorProps {
  /** Current intervals as [[start, end], ...] */
  intervals: number[][];
  /** Called when intervals change. If matchId is provided, also saves to server. */
  onChange: (intervals: number[][]) => void;
  /** Optional match ID — if set, saves to server on change */
  matchId?: string;
}

function totalMinutes(intervals: number[][]): number {
  return intervals.reduce((sum, [s, e]) => sum + (e - s), 0);
}

export default function WatchIntervalEditor({ intervals, onChange, matchId }: WatchIntervalEditorProps) {
  const [saving, setSaving] = useState(false);
  const isFullMatch = intervals.length === 1 && intervals[0][0] === 0 && intervals[0][1] === 90;
  const maxMinute = Math.max(90, ...intervals.map(([, e]) => e));

  function setIntervals(next: number[][]) {
    onChange(next);
    if (matchId) {
      setSaving(true);
      fetch(`/api/matches/${matchId}/intervals`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intervals: next }),
      }).finally(() => setSaving(false));
    }
  }

  function toggleFullMatch() {
    if (isFullMatch) {
      setIntervals([[0, 45]]);
    } else {
      setIntervals([[0, 90]]);
    }
  }

  function addInterval() {
    const last = intervals[intervals.length - 1];
    const start = last ? Math.min(last[1], 119) : 0;
    const end = Math.min(start + 15, 120);
    if (start < end) {
      setIntervals([...intervals, [start, end]]);
    }
  }

  function removeInterval(index: number) {
    if (intervals.length <= 1) return;
    setIntervals(intervals.filter((_, i) => i !== index));
  }

  function updateInterval(index: number, field: 0 | 1, value: number) {
    const next = intervals.map((iv, i) => {
      if (i !== index) return iv;
      const updated = [...iv];
      updated[field] = value;
      return updated;
    });
    // Only save if valid
    const iv = next[index];
    if (iv[0] >= 0 && iv[1] <= 120 && iv[0] < iv[1]) {
      setIntervals(next);
    }
  }

  return (
    <div className="space-y-3">
      {/* Timeline visualization */}
      <div className="relative h-6 bg-surface rounded-full overflow-hidden border border-card-border">
        {intervals.map(([s, e], i) => (
          <div
            key={i}
            className="absolute top-0 h-full bg-accent/40 border-x border-accent/60"
            style={{
              left: `${(s / maxMinute) * 100}%`,
              width: `${((e - s) / maxMinute) * 100}%`,
            }}
          />
        ))}
        {/* Half-time marker */}
        <div
          className="absolute top-0 h-full w-px bg-muted/30"
          style={{ left: `${(45 / maxMinute) * 100}%` }}
        />
        {/* Minute labels */}
        <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[10px] text-muted">0&apos;</span>
        <span className="absolute top-1/2 -translate-y-1/2 text-[10px] text-muted" style={{ left: `${(45 / maxMinute) * 100}%`, transform: "translateX(-50%) translateY(-50%)" }}>45&apos;</span>
        <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-muted">{maxMinute}&apos;</span>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={toggleFullMatch}
          className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
            isFullMatch
              ? "bg-accent/20 border-accent/40 text-accent"
              : "border-card-border text-muted hover:text-white hover:border-accent/30"
          }`}
        >
          Full match
        </button>

        <span className="text-xs text-muted">
          {totalMinutes(intervals)} min watched
        </span>

        {saving && (
          <span className="text-xs text-muted/60">Saving...</span>
        )}
      </div>

      {/* Interval rows */}
      {!isFullMatch && (
        <div className="space-y-2">
          {intervals.map(([s, e], i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={119}
                value={s}
                onChange={(ev) => updateInterval(i, 0, parseInt(ev.target.value) || 0)}
                className="w-16 bg-surface border border-card-border rounded px-2 py-1 text-sm text-white text-center focus:outline-none focus:ring-1 focus:ring-accent"
              />
              <span className="text-muted text-xs">to</span>
              <input
                type="number"
                min={1}
                max={120}
                value={e}
                onChange={(ev) => updateInterval(i, 1, parseInt(ev.target.value) || 1)}
                className="w-16 bg-surface border border-card-border rounded px-2 py-1 text-sm text-white text-center focus:outline-none focus:ring-1 focus:ring-accent"
              />
              <span className="text-xs text-muted">{e - s} min</span>
              {intervals.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeInterval(i)}
                  className="text-muted/50 hover:text-red-400 transition-colors ml-1"
                >
                  <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={addInterval}
            className="text-xs text-muted hover:text-accent transition-colors flex items-center gap-1"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            Add interval
          </button>
        </div>
      )}
    </div>
  );
}
