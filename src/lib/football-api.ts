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

function toMatchResult(m: FootballDataMatch): MatchSearchResult {
  const dateOnly = m.utcDate.split("T")[0];
  const round = m.matchday ? `Matchday ${m.matchday}` : m.stage;
  return {
    id: m.id,
    homeTeam: m.homeTeam.name,
    awayTeam: m.awayTeam.name,
    homeScore: m.score.fullTime.home,
    awayScore: m.score.fullTime.away,
    competition: m.competition.name,
    round,
    date: dateOnly,
    venue: m.venue ?? "",
    homeCrest: m.homeTeam.crest,
    awayCrest: m.awayTeam.crest,
  };
}

export async function searchMatchesByDate(
  dateFrom: string,
  dateTo: string
): Promise<MatchSearchResult[]> {
  const res = await fetchApi(
    `/matches?dateFrom=${dateFrom}&dateTo=${dateTo}&status=FINISHED`
  );
  if (!res.ok) {
    throw new Error(`football-data.org API error: ${res.status}`);
  }
  const data: FootballDataResponse = await res.json();
  return data.matches.map(toMatchResult);
}
