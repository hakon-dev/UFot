// Priority order for competition sorting. Lower index = higher priority.
// Codes from football-data.org v4 API.
const COMPETITION_PRIORITY: string[] = [
  "CL",   // UEFA Champions League
  "PL",   // Premier League
  "PD",   // La Liga
  "BL1",  // Bundesliga
  "SA",   // Serie A
  "FL1",  // Ligue 1
  "ELC",  // Championship
  "DED",  // Eredivisie
  "PPL",  // Primeira Liga
  "CLI",  // Copa Libertadores
  "BSA",  // Brasileirao Serie A
  "WC",   // FIFA World Cup
  "EC",   // European Championship
];

export function getCompetitionSortKey(code: string): number {
  const idx = COMPETITION_PRIORITY.indexOf(code);
  return idx === -1 ? COMPETITION_PRIORITY.length : idx;
}
