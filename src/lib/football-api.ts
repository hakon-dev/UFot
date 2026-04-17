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

// Types for match detail response from /v4/matches/{id}
interface FootballDataPlayer {
  id: number;
  name: string;
  position: string | null;
  shirtNumber: number | null;
}

interface FootballDataGoal {
  minute: number;
  injuryTime: number | null;
  type: string; // REGULAR, OWN_GOAL, PENALTY
  team: { id: number; name: string };
  scorer: FootballDataPlayer;
  assist: FootballDataPlayer | null;
}

interface FootballDataSubstitution {
  minute: number;
  team: { id: number; name: string };
  playerOut: FootballDataPlayer;
  playerIn: FootballDataPlayer;
}

interface FootballDataDetailResponse {
  id: number;
  homeTeam: {
    id: number;
    name: string;
    lineup: FootballDataPlayer[];
    bench: FootballDataPlayer[];
  };
  awayTeam: {
    id: number;
    name: string;
    lineup: FootballDataPlayer[];
    bench: FootballDataPlayer[];
  };
  goals: FootballDataGoal[];
  substitutions: FootballDataSubstitution[];
}

export interface MatchDetailResult {
  goals: Array<{
    minute: number;
    team: string;
    scorerName: string;
    assistName: string | null;
    type: string;
  }>;
  substitutions: Array<{
    minute: number;
    team: string;
    playerOut: string;
    playerIn: string;
  }>;
  homeLineup: Array<{ name: string; position: string | null; shirtNumber: number | null; isStarter: boolean }>;
  awayLineup: Array<{ name: string; position: string | null; shirtNumber: number | null; isStarter: boolean }>;
}

export async function fetchMatchDetails(matchId: number): Promise<MatchDetailResult> {
  const res = await fetchApi(`/matches/${matchId}`);
  if (!res.ok) {
    throw new Error(`football-data.org API error: ${res.status}`);
  }
  const data: FootballDataDetailResponse = await res.json();

  return {
    goals: (data.goals ?? []).map((g) => ({
      minute: g.minute,
      team: g.team.name,
      scorerName: g.scorer.name,
      assistName: g.assist?.name ?? null,
      type: g.type,
    })),
    substitutions: (data.substitutions ?? []).map((s) => ({
      minute: s.minute,
      team: s.team.name,
      playerOut: s.playerOut.name,
      playerIn: s.playerIn.name,
    })),
    homeLineup: [
      ...(data.homeTeam.lineup ?? []).map((p) => ({
        name: p.name,
        position: p.position,
        shirtNumber: p.shirtNumber,
        isStarter: true,
      })),
      ...(data.homeTeam.bench ?? []).map((p) => ({
        name: p.name,
        position: p.position,
        shirtNumber: p.shirtNumber,
        isStarter: false,
      })),
    ],
    awayLineup: [
      ...(data.awayTeam.lineup ?? []).map((p) => ({
        name: p.name,
        position: p.position,
        shirtNumber: p.shirtNumber,
        isStarter: true,
      })),
      ...(data.awayTeam.bench ?? []).map((p) => ({
        name: p.name,
        position: p.position,
        shirtNumber: p.shirtNumber,
        isStarter: false,
      })),
    ],
  };
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
