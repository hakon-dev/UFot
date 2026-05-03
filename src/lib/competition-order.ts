// Priority order for competition sorting. Lower index = higher priority.
// Keys are API-Football league IDs (stringified) from api-sports.io v3.
// Doubles as a disambiguation hint when a name lookup returns multiple candidates
// (see /api/search and the home-page rescue): cup competitions named "League Cup"
// or "FA Cup" exist in many countries, so we explicitly list the English ones.
const COMPETITION_PRIORITY: string[] = [
  "2",    // UEFA Champions League
  "39",   // Premier League
  "140",  // La Liga
  "78",   // Bundesliga
  "135",  // Serie A
  "61",   // Ligue 1
  "1",    // FIFA World Cup
  "4",    // Euro Championship
  "3",    // UEFA Europa League
  "103",  // Eliteserien (Norway)
  "40",   // Championship (England)
  "45",   // FA Cup (England)
  "48",   // EFL Cup / League Cup (England)
  "88",   // Eredivisie
  "94",   // Primeira Liga
  "13",   // Copa Libertadores
  "71",   // Série A (Brazil)
  "113",  // Allsvenskan (Sweden)
  "119",  // Superliga (Denmark)
  "244",  // Veikkausliiga (Finland)
];

export function getCompetitionSortKey(code: string): number {
  const idx = COMPETITION_PRIORITY.indexOf(code);
  return idx === -1 ? COMPETITION_PRIORITY.length : idx;
}
