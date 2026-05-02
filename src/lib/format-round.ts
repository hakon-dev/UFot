// Normalizes API-Football's verbose round strings into more natural labels.
// "Regular Season - 14" → "Gameweek 14"
// "Group Stage - 1"     → "Group Stage · MD1"
// "League Stage - 1"    → "League Stage · MD1"  (CL/EL/CC Swiss-model)
// Knockout names ("Round of 16", "Quarter-finals", "Final", etc.) pass through.
export function formatRound(round: string | null | undefined): string | null {
  if (!round) return null;
  const trimmed = round.trim();

  const regular = trimmed.match(/^Regular Season\s*-\s*(\d+)$/i);
  if (regular) return `Gameweek ${regular[1]}`;

  const group = trimmed.match(/^Group Stage\s*-\s*(\d+)$/i);
  if (group) return `Group Stage · MD${group[1]}`;

  const leagueStage = trimmed.match(/^League Stage\s*-\s*(\d+)$/i);
  if (leagueStage) return `League Stage · MD${leagueStage[1]}`;

  const namedGroup = trimmed.match(/^Group\s+([A-Z])\s*-\s*(\d+)$/i);
  if (namedGroup) return `Group ${namedGroup[1].toUpperCase()} · MD${namedGroup[2]}`;

  return trimmed;
}
