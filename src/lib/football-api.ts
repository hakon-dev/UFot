const API_BASE = "https://api.football-data.org/v4";

interface FootballDataMatch {
  id: number;
  utcDate: string;
  status: string;
  matchday: number | null;
  stage: string;
  venue: string | null;
  homeTeam: {
    id: number;
    name: string;
    shortName: string;
    tla: string;
    crest: string;
  };
  awayTeam: {
    id: number;
    name: string;
    shortName: string;
    tla: string;
    crest: string;
  };
  score: {
    winner: string | null;
    fullTime: { home: number | null; away: number | null };
    halfTime: { home: number | null; away: number | null };
  };
  competition: {
    id: number;
    name: string;
    code: string;
    type: string;
    emblem: string;
  };
}

interface FootballDataResponse {
  matches: FootballDataMatch[];
  resultSet: {
    count: number;
  };
}

export interface MatchSearchResult {
  id: number;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  competition: string;
  competitionCode: string;
  competitionEmblem: string;
  round: string;
  date: string;
  venue: string;
  homeCrest: string;
  awayCrest: string;
}

function getApiKey(): string {
  const key = process.env.FOOTBALL_DATA_API_KEY;
  if (!key || key === "your_api_key_here") {
    throw new Error("FOOTBALL_DATA_API_KEY is not configured");
  }
  return key;
}

async function fetchApi(path: string): Promise<Response> {
  return fetch(`${API_BASE}${path}`, {
    headers: { "X-Auth-Token": getApiKey() },
  });
}

function toLocalDate(utcDate: string, timeZone: string): string {
  const d = new Date(utcDate);
  const parts = d.toLocaleDateString("en-CA", { timeZone }); // en-CA gives YYYY-MM-DD
  return parts;
}

function toMatchResult(
  m: FootballDataMatch,
  timeZone: string
): MatchSearchResult {
  const dateOnly = toLocalDate(m.utcDate, timeZone);
  const round = m.matchday ? `Matchday ${m.matchday}` : m.stage;
  return {
    id: m.id,
    homeTeam: m.homeTeam.name,
    awayTeam: m.awayTeam.name,
    homeScore: m.score.fullTime.home,
    awayScore: m.score.fullTime.away,
    competition: m.competition.name,
    competitionCode: m.competition.code,
    competitionEmblem: m.competition.emblem,
    round,
    date: dateOnly,
    venue: m.venue ?? "",
    homeCrest: m.homeTeam.crest,
    awayCrest: m.awayTeam.crest,
  };
}

function shiftDate(date: string, days: number): string {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split("T")[0];
}

export async function searchMatchesByDate(
  dateFrom: string,
  dateTo: string,
  timeZone: string = "UTC"
): Promise<MatchSearchResult[]> {
  // Widen the query range by 1 day on each side to account for timezone offsets
  const wideFrom = shiftDate(dateFrom, -1);
  const wideTo = shiftDate(dateTo, 1);

  const res = await fetchApi(
    `/matches?dateFrom=${wideFrom}&dateTo=${wideTo}&status=FINISHED`
  );
  if (!res.ok) {
    throw new Error(`football-data.org API error: ${res.status}`);
  }
  const data: FootballDataResponse = await res.json();

  // Convert to local dates and filter to only the requested range
  return data.matches
    .map((m) => toMatchResult(m, timeZone))
    .filter((m) => m.date >= dateFrom && m.date <= dateTo);
}
