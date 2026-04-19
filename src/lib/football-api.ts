const API_BASE = "https://v3.football.api-sports.io";

interface ApiFootballFixture {
  fixture: {
    id: number;
    date: string;
    timezone: string;
    venue: { id: number | null; name: string | null; city: string | null };
    status: { long: string; short: string; elapsed: number | null };
  };
  league: {
    id: number;
    name: string;
    country: string;
    logo: string;
    flag: string | null;
    season: number;
    round: string;
  };
  teams: {
    home: { id: number; name: string; logo: string; winner: boolean | null };
    away: { id: number; name: string; logo: string; winner: boolean | null };
  };
  goals: { home: number | null; away: number | null };
  score: {
    halftime: { home: number | null; away: number | null };
    fulltime: { home: number | null; away: number | null };
    extratime: { home: number | null; away: number | null };
    penalty: { home: number | null; away: number | null };
  };
}

interface ApiFootballResponse<T> {
  response: T[];
  errors: unknown;
  results: number;
}

export interface MatchSearchResult {
  id: number;
  homeTeam: string;
  awayTeam: string;
  homeTeamId: number;
  awayTeamId: number;
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
  const key = process.env.API_FOOTBALL_KEY;
  if (!key || key === "your_api_key_here") {
    throw new Error("API_FOOTBALL_KEY is not configured");
  }
  return key;
}

async function fetchApi(path: string): Promise<Response> {
  return fetch(`${API_BASE}${path}`, {
    headers: { "x-apisports-key": getApiKey() },
  });
}

function toLocalDate(utcDate: string, timeZone: string): string {
  const d = new Date(utcDate);
  return d.toLocaleDateString("en-CA", { timeZone });
}

function toMatchResult(
  f: ApiFootballFixture,
  timeZone: string
): MatchSearchResult {
  return {
    id: f.fixture.id,
    homeTeam: f.teams.home.name,
    awayTeam: f.teams.away.name,
    homeTeamId: f.teams.home.id,
    awayTeamId: f.teams.away.id,
    homeScore: f.goals.home,
    awayScore: f.goals.away,
    competition: f.league.name,
    competitionCode: String(f.league.id),
    competitionEmblem: f.league.logo,
    round: f.league.round,
    date: toLocalDate(f.fixture.date, timeZone),
    venue: f.fixture.venue.name ?? "",
    homeCrest: f.teams.home.logo,
    awayCrest: f.teams.away.logo,
  };
}

function enumerateDates(from: string, to: string): string[] {
  const out: string[] = [];
  const start = new Date(from + "T00:00:00Z");
  const end = new Date(to + "T00:00:00Z");
  for (const d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(d.toISOString().split("T")[0]);
  }
  return out;
}

// Statuses we consider "finished" — full time, after extra time, after penalties.
const FINISHED_STATUSES = new Set(["FT", "AET", "PEN"]);

export async function searchMatchesByDate(
  dateFrom: string,
  dateTo: string,
  timeZone: string = "UTC"
): Promise<MatchSearchResult[]> {
  const dates = enumerateDates(dateFrom, dateTo);
  const tz = encodeURIComponent(timeZone);

  const results = await Promise.all(
    dates.map(async (date) => {
      const res = await fetchApi(`/fixtures?date=${date}&timezone=${tz}`);
      if (!res.ok) {
        throw new Error(`api-football error: ${res.status}`);
      }
      const data: ApiFootballResponse<ApiFootballFixture> = await res.json();
      return data.response ?? [];
    })
  );

  const fixtures = results.flat();
  return fixtures
    .filter((f) => FINISHED_STATUSES.has(f.fixture.status.short))
    .map((f) => toMatchResult(f, timeZone))
    .filter((m) => m.date >= dateFrom && m.date <= dateTo);
}

interface ApiFootballEventPlayer {
  id: number | null;
  name: string | null;
}

interface ApiFootballEvent {
  time: { elapsed: number; extra: number | null };
  team: { id: number; name: string; logo: string };
  player: ApiFootballEventPlayer;
  // For "subst", API-Football puts the player coming ON in `assist` and the player going OFF in `player`.
  assist: ApiFootballEventPlayer;
  type: string; // "Goal" | "Card" | "subst" | "Var"
  detail: string; // e.g. "Normal Goal", "Own Goal", "Penalty", "Missed Penalty"
  comments: string | null;
}

interface ApiFootballLineupPlayer {
  player: {
    id: number;
    name: string;
    number: number | null;
    pos: string | null;
    grid: string | null;
  };
}

interface ApiFootballLineup {
  team: {
    id: number;
    name: string;
    logo: string;
    colors: unknown;
  };
  formation: string | null;
  startXI: ApiFootballLineupPlayer[];
  substitutes: ApiFootballLineupPlayer[];
  coach: { id: number; name: string; photo: string | null };
}

export interface LineupPlayerDetail {
  name: string;
  position: string | null;
  shirtNumber: number | null;
  isStarter: boolean;
  playerId: number | null;
  grid: string | null;
}

export interface MatchDetailResult {
  goals: Array<{
    minute: number;
    team: string;
    scorerName: string;
    assistName: string | null;
    scorerId: number | null;
    assistId: number | null;
    type: string;
  }>;
  substitutions: Array<{
    minute: number;
    team: string;
    playerOut: string;
    playerIn: string;
    playerOutId: number | null;
    playerInId: number | null;
  }>;
  cards: Array<{
    minute: number;
    team: string;
    playerName: string;
    playerId: number | null;
    cardType: "YELLOW" | "RED" | "YELLOWRED";
  }>;
  homeLineup: LineupPlayerDetail[];
  awayLineup: LineupPlayerDetail[];
  homeFormation: string | null;
  awayFormation: string | null;
  homeTeamId: number | null;
  awayTeamId: number | null;
}

function mapGoalType(detail: string): string {
  if (detail === "Own Goal") return "OWN_GOAL";
  if (detail === "Penalty") return "PENALTY";
  return "REGULAR";
}

function mapCardType(detail: string): "YELLOW" | "RED" | "YELLOWRED" | null {
  const d = detail.toLowerCase();
  if (d.includes("second yellow")) return "YELLOWRED";
  if (d.includes("red")) return "RED";
  if (d.includes("yellow")) return "YELLOW";
  return null;
}

function mapLineupPlayers(
  lineup: ApiFootballLineup | undefined
): LineupPlayerDetail[] {
  if (!lineup) return [];
  return [
    ...lineup.startXI.map((p) => ({
      name: p.player.name,
      position: p.player.pos,
      shirtNumber: p.player.number,
      isStarter: true,
      playerId: p.player.id ?? null,
      grid: p.player.grid ?? null,
    })),
    ...lineup.substitutes.map((p) => ({
      name: p.player.name,
      position: p.player.pos,
      shirtNumber: p.player.number,
      isStarter: false,
      playerId: p.player.id ?? null,
      grid: p.player.grid ?? null,
    })),
  ];
}

interface ApiFootballPlayerProfile {
  player: {
    id: number;
    name: string;
    firstname: string | null;
    lastname: string | null;
    nationality: string | null;
    photo: string | null;
    position: string | null;
    number: number | null;
  };
}

export interface PlayerProfileResult {
  id: number;
  name: string;
  nationality: string | null;
  photo: string | null;
  position: string | null;
  shirtNumber: number | null;
}

interface ApiFootballTeamProfile {
  team: {
    id: number;
    name: string;
    country: string | null;
    logo: string | null;
    national: boolean | null;
  };
}

export interface TeamProfileResult {
  id: number;
  name: string;
  country: string | null;
  logo: string | null;
  national: boolean | null;
}

export async function fetchTeamProfile(
  teamId: number
): Promise<TeamProfileResult | null> {
  const res = await fetchApi(`/teams?id=${teamId}`);
  if (!res.ok) {
    throw new Error(`api-football error: teams ${res.status}`);
  }
  const data: ApiFootballResponse<ApiFootballTeamProfile> = await res.json();
  const row = data.response?.[0];
  if (!row) return null;
  return {
    id: row.team.id,
    name: row.team.name,
    country: row.team.country ?? null,
    logo: row.team.logo ?? null,
    national: row.team.national ?? null,
  };
}

export async function fetchPlayerProfile(
  playerId: number
): Promise<PlayerProfileResult | null> {
  const res = await fetchApi(`/players/profiles?player=${playerId}`);
  if (!res.ok) {
    throw new Error(`api-football error: players/profiles ${res.status}`);
  }
  const data: ApiFootballResponse<ApiFootballPlayerProfile> = await res.json();
  const row = data.response?.[0];
  if (!row) return null;
  const p = row.player;
  return {
    id: p.id,
    name: p.name,
    nationality: p.nationality ?? null,
    photo: p.photo ?? null,
    position: p.position ?? null,
    shirtNumber: p.number ?? null,
  };
}

interface ApiFootballTransferTeam {
  id: number | null;
  name: string | null;
  logo: string | null;
}

interface ApiFootballTransferRow {
  date: string;
  type: string | null;
  teams: { in: ApiFootballTransferTeam; out: ApiFootballTransferTeam };
}

interface ApiFootballTransfers {
  player: { id: number; name: string };
  transfers: ApiFootballTransferRow[];
}

export interface PlayerTransfer {
  date: string;
  type: string | null;
  teamIn: { id: number | null; name: string | null; logo: string | null };
  teamOut: { id: number | null; name: string | null; logo: string | null };
}

export async function fetchPlayerTransfers(
  playerId: number
): Promise<PlayerTransfer[]> {
  const res = await fetchApi(`/transfers?player=${playerId}`);
  if (!res.ok) {
    throw new Error(`api-football error: transfers ${res.status}`);
  }
  const data: ApiFootballResponse<ApiFootballTransfers> = await res.json();
  const row = data.response?.[0];
  if (!row) return [];
  return row.transfers.map((t) => ({
    date: t.date,
    type: t.type ?? null,
    teamIn: { id: t.teams.in.id ?? null, name: t.teams.in.name ?? null, logo: t.teams.in.logo ?? null },
    teamOut: { id: t.teams.out.id ?? null, name: t.teams.out.name ?? null, logo: t.teams.out.logo ?? null },
  }));
}

export async function fetchFixtureSummary(
  fixtureId: number,
  timeZone: string = "UTC"
): Promise<MatchSearchResult | null> {
  const tz = encodeURIComponent(timeZone);
  const res = await fetchApi(`/fixtures?id=${fixtureId}&timezone=${tz}`);
  if (!res.ok) {
    throw new Error(`api-football error: fixtures ${res.status}`);
  }
  const data: ApiFootballResponse<ApiFootballFixture> = await res.json();
  const row = data.response?.[0];
  if (!row) return null;
  return toMatchResult(row, timeZone);
}

export async function fetchMatchDetails(
  matchId: number
): Promise<MatchDetailResult> {
  const [eventsRes, lineupsRes, fixtureRes] = await Promise.all([
    fetchApi(`/fixtures/events?fixture=${matchId}`),
    fetchApi(`/fixtures/lineups?fixture=${matchId}`),
    fetchApi(`/fixtures?id=${matchId}`),
  ]);

  if (!eventsRes.ok || !lineupsRes.ok || !fixtureRes.ok) {
    throw new Error(
      `api-football error: events=${eventsRes.status} lineups=${lineupsRes.status} fixture=${fixtureRes.status}`
    );
  }

  const [events, lineups, fixture]: [
    ApiFootballResponse<ApiFootballEvent>,
    ApiFootballResponse<ApiFootballLineup>,
    ApiFootballResponse<ApiFootballFixture>
  ] = await Promise.all([eventsRes.json(), lineupsRes.json(), fixtureRes.json()]);

  const homeTeamId = fixture.response[0]?.teams.home.id;
  const awayTeamId = fixture.response[0]?.teams.away.id;
  const homeLineup = lineups.response.find((l) => l.team.id === homeTeamId);
  const awayLineup = lineups.response.find((l) => l.team.id === awayTeamId);

  const goalEvents = events.response.filter(
    (e) => e.type === "Goal" && e.detail !== "Missed Penalty"
  );
  const subEvents = events.response.filter((e) => e.type === "subst");
  const cardEvents = events.response.filter((e) => e.type === "Card");

  return {
    goals: goalEvents.map((e) => ({
      minute: e.time.elapsed,
      team: e.team.name,
      scorerName: e.player.name ?? "",
      assistName: e.assist.name ?? null,
      scorerId: e.player.id ?? null,
      assistId: e.assist.id ?? null,
      type: mapGoalType(e.detail),
    })),
    substitutions: subEvents.map((e) => ({
      minute: e.time.elapsed,
      team: e.team.name,
      playerOut: e.player.name ?? "",
      playerIn: e.assist.name ?? "",
      playerOutId: e.player.id ?? null,
      playerInId: e.assist.id ?? null,
    })),
    cards: cardEvents
      .map((e) => {
        const cardType = mapCardType(e.detail);
        if (!cardType) return null;
        return {
          minute: e.time.elapsed,
          team: e.team.name,
          playerName: e.player.name ?? "",
          playerId: e.player.id ?? null,
          cardType,
        };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null),
    homeLineup: mapLineupPlayers(homeLineup),
    awayLineup: mapLineupPlayers(awayLineup),
    homeFormation: homeLineup?.formation ?? null,
    awayFormation: awayLineup?.formation ?? null,
    homeTeamId: homeTeamId ?? null,
    awayTeamId: awayTeamId ?? null,
  };
}
