"use client";

import { useEffect, useState } from "react";

interface WatchIntervalEditorProps {
  /** Current intervals as [[start, end], ...] */
  intervals: number[][];
  /** Called when intervals are committed. */
  onChange: (intervals: number[][]) => void;
  /** Optional match ID — if set, editor gates edits behind Edit/Save/Cancel with a confirm prompt. */
  matchId?: string;
  /**
   * Total length of the match in minutes (90 for regulation, 120 for matches that went to
   * extra time). Drives the "Full match" toggle and timeline labels. Defaults to 90.
   */
  matchLength?: 90 | 120;
}

function totalMinutes(intervals: number[][]): number {
  return intervals.reduce((sum, [s, e]) => sum + (e - s), 0);
}

function isValid(intervals: number[][], maxEnd: number): boolean {
  return intervals.every(
    ([s, e]) => Number.isFinite(s) && Number.isFinite(e) && s >= 0 && e <= maxEnd && s < e
  );
}

function sameIntervals(a: number[][], b: number[][]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i][0] !== b[i][0] || a[i][1] !== b[i][1]) return false;
  }
  return true;
}

export default function WatchIntervalEditor({
  intervals,
  onChange,
  matchId,
  matchLength = 90,
}: WatchIntervalEditorProps) {
  const confirmMode = matchId != null;
  const [editing, setEditing] = useState(!confirmMode);
  const [draft, setDraft] = useState<number[][]>(intervals);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Keep the draft synced with the committed intervals when we aren't actively editing.
  // In non-confirm mode there's no Edit/Save gating, so the parent's intervals are always
  // the source of truth and draft must follow them on every change.
  useEffect(() => {
    if (!confirmMode || !editing) setDraft(intervals);
  }, [intervals, editing, confirmMode]);

  const active = editing ? draft : intervals;
  const isFullMatch =
    active.length === 1 && active[0][0] === 0 && active[0][1] === matchLength;
  // Always render at least up to matchLength so a 120-minute timeline isn't squished when the
  // user has only entered a 0–45 interval; if the user enters a value past matchLength (which
  // validation rejects but the input still shows), expand the bar to fit.
  const maxMinute = Math.max(matchLength, ...active.map(([, e]) => e));
  const dirty = !sameIntervals(draft, intervals);

  function propagate(next: number[][]) {
    if (confirmMode) {
      setDraft(next);
    } else {
      onChange(next);
    }
  }

  function toggleFullMatch() {
    propagate(isFullMatch ? [[0, 45]] : [[0, matchLength]]);
  }

  function addInterval() {
    const last = active[active.length - 1];
    const start = last ? Math.min(last[1], matchLength - 1) : 0;
    const end = Math.min(start + 15, matchLength);
    if (start < end) {
      propagate([...active, [start, end]]);
    }
  }

  function removeInterval(index: number) {
    if (active.length <= 1) return;
    propagate(active.filter((_, i) => i !== index));
  }

  function updateInterval(index: number, field: 0 | 1, value: number) {
    const next = active.map((iv, i) => {
      if (i !== index) return iv;
      const updated = [...iv];
      updated[field] = value;
      return updated;
    });
    propagate(next);
  }

  function startEdit() {
    setDraft(intervals);
    setError("");
    setEditing(true);
  }

  function cancelEdit() {
    setDraft(intervals);
    setError("");
    setEditing(false);
  }

  async function saveEdit() {
    if (!isValid(draft, matchLength)) {
      setError(
        `Intervals must be within 0–${matchLength} and each end must be greater than its start.`
      );
      return;
    }
    if (!dirty) {
      setEditing(false);
      return;
    }
    if (!confirm("Save the updated watch intervals?")) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/matches/${matchId}/intervals`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intervals: draft }),
      });
      if (!res.ok) throw new Error("Save failed");
      onChange(draft);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      {/* Timeline visualization */}
      <div className="space-y-1.5">
        <div className="relative h-7 bg-background rounded-md overflow-hidden border border-card-border">
          {/* Extra-time region tint — sits behind the watched bars so the 90–120 range reads
              as visually distinct from regulation, regardless of which intervals the user has
              selected. Diagonal stripes keep it readable even when the watched bar covers it. */}
          {matchLength === 120 && (
            <div
              className="absolute top-0 h-full"
              style={{
                left: `${(90 / maxMinute) * 100}%`,
                width: `${((maxMinute - 90) / maxMinute) * 100}%`,
                backgroundImage:
                  "repeating-linear-gradient(45deg, rgba(255,255,255,0.06) 0 4px, transparent 4px 8px)",
              }}
            />
          )}
          {active.map(([s, e], i) => (
            <div
              key={i}
              className="absolute top-0 h-full bg-accent"
              style={{
                left: `${(s / maxMinute) * 100}%`,
                width: `${((e - s) / maxMinute) * 100}%`,
              }}
            />
          ))}
          {/* Half-time marker */}
          <div
            className="absolute top-0 h-full w-px bg-black/50"
            style={{ left: `${(45 / maxMinute) * 100}%` }}
          />
          {/* End-of-90 marker (only shown when the timeline extends into extra time) */}
          {matchLength === 120 && (
            <>
              <div
                className="absolute top-0 h-full w-px bg-black/70"
                style={{ left: `${(90 / maxMinute) * 100}%` }}
              />
              {/* ET half-time marker (between the two 15-minute halves of extra time) */}
              <div
                className="absolute top-0 h-full w-px bg-black/50"
                style={{ left: `${(105 / maxMinute) * 100}%` }}
              />
            </>
          )}
        </div>
        {/* Minute labels — below the bar for readability */}
        <div className="relative h-3.5 text-[11px] text-slate-300 tabular-nums">
          <span className="absolute left-0 top-0">0&apos;</span>
          <span
            className="absolute top-0 -translate-x-1/2"
            style={{ left: `${(45 / maxMinute) * 100}%` }}
          >
            45&apos;
          </span>
          {matchLength === 120 && (
            <>
              <span
                className="absolute top-0 -translate-x-1/2"
                style={{ left: `${(90 / maxMinute) * 100}%` }}
              >
                90&apos;
              </span>
              <span
                className="absolute top-0 -translate-x-1/2"
                style={{ left: `${(105 / maxMinute) * 100}%` }}
              >
                105&apos;
              </span>
            </>
          )}
          <span className="absolute right-0 top-0">{maxMinute}&apos;</span>
        </div>
      </div>

      {/* Summary + edit controls */}
      <div className="flex items-center gap-3 flex-wrap">
        {editing && (
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
        )}

        <span className="text-xs text-muted">
          {totalMinutes(active)} min watched
        </span>

        {confirmMode && !editing && (
          <button
            type="button"
            onClick={startEdit}
            className="text-xs px-3 py-1.5 rounded-full border border-card-border text-slate-300 hover:text-accent hover:border-accent/40 transition-colors ml-auto"
          >
            Edit intervals
          </button>
        )}

        {confirmMode && editing && (
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={cancelEdit}
              disabled={saving}
              className="text-xs px-3 py-1.5 rounded-full border border-card-border text-muted hover:text-white hover:border-card-border transition-colors disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={saveEdit}
              disabled={saving || !isValid(draft, matchLength)}
              className="text-xs px-3 py-1.5 rounded-full bg-accent text-black font-semibold hover:bg-accent-dim transition-colors disabled:opacity-40"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        )}
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      {/* Interval rows — only visible in edit mode. */}
      {editing && (
        <div className="space-y-2">
          <p className="text-[11px] text-muted">
            Type the minutes you watched, or click <span className="text-slate-300">Add interval</span> for a second segment.
          </p>
          {active.map(([s, e], i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={matchLength - 1}
                value={Number.isFinite(s) ? s : ""}
                onChange={(ev) => {
                  const v = ev.target.value;
                  updateInterval(i, 0, v === "" ? 0 : parseInt(v, 10));
                }}
                className="w-16 bg-surface border border-card-border rounded px-2 py-1 text-sm text-white text-center focus:outline-none focus:ring-1 focus:ring-accent"
              />
              <span className="text-muted text-xs">to</span>
              <input
                type="number"
                min={1}
                max={matchLength}
                value={Number.isFinite(e) ? e : ""}
                onChange={(ev) => {
                  const v = ev.target.value;
                  updateInterval(i, 1, v === "" ? 0 : parseInt(v, 10));
                }}
                className="w-16 bg-surface border border-card-border rounded px-2 py-1 text-sm text-white text-center focus:outline-none focus:ring-1 focus:ring-accent"
              />
              <span className="text-xs text-muted tabular-nums">{Math.max(0, e - s)} min</span>
              {active.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeInterval(i)}
                  className="text-muted/50 hover:text-red-400 transition-colors ml-1"
                  aria-label="Remove interval"
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
            className="text-xs px-3 py-1.5 rounded-full border border-card-border text-slate-300 hover:text-accent hover:border-accent/40 transition-colors inline-flex items-center gap-1.5"
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
