export function formatPosition(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const v = raw.trim();
  if (!v) return null;
  if (v.length === 1) {
    const c = v.toUpperCase();
    if (c === "G") return "GK";
    if (c === "D") return "DEF";
    if (c === "M") return "MID";
    if (c === "F") return "FWD";
    return c;
  }
  const lower = v.toLowerCase();
  if (lower.startsWith("goalkeep") || lower === "gk") return "GK";
  if (lower.startsWith("defend") || lower === "def") return "DEF";
  if (lower.startsWith("midfield") || lower === "mid") return "MID";
  if (lower.startsWith("attack") || lower.startsWith("forward") || lower === "fwd" || lower === "striker") return "FWD";
  return v;
}
