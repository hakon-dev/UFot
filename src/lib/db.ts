import Database from "better-sqlite3";
import path from "path";
import crypto from "crypto";

const dbPath = path.join(process.cwd(), "data", "ufot.db");
const db = new Database(dbPath);

// Enable WAL mode for better concurrent read performance
db.pragma("journal_mode = WAL");
// Enable foreign keys for cascading deletes
db.pragma("foreign_keys = ON");

// Create table if it doesn't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS matches (
    id TEXT PRIMARY KEY,
    home_team TEXT NOT NULL,
    away_team TEXT NOT NULL,
    home_score INTEGER NOT NULL,
    away_score INTEGER NOT NULL,
    competition TEXT,
    round TEXT,
    date TEXT NOT NULL,
    venue TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

// Migration: add columns if they don't exist
function readColumns(): string[] {
  return (db.prepare("PRAGMA table_info(matches)").all() as { name: string }[]).map((c) => c.name);
}
let columnNames = readColumns();
if (!columnNames.includes("home_crest")) {
  db.exec("ALTER TABLE matches ADD COLUMN home_crest TEXT");
}
if (!columnNames.includes("away_crest")) {
  db.exec("ALTER TABLE matches ADD COLUMN away_crest TEXT");
}
if (!columnNames.includes("football_data_id") && !columnNames.includes("external_match_id")) {
  db.exec("ALTER TABLE matches ADD COLUMN external_match_id INTEGER");
}
if (!columnNames.includes("watch_intervals")) {
  db.exec("ALTER TABLE matches ADD COLUMN watch_intervals TEXT DEFAULT '[[0,90]]'");
}
if (!columnNames.includes("details_fetched")) {
  db.exec("ALTER TABLE matches ADD COLUMN details_fetched INTEGER DEFAULT 0");
}

// Rename football_data_id → external_match_id (old football-data.org IDs no longer resolve
// against the new api-football backend; they're kept on historical rows but treated as opaque).
columnNames = readColumns();
if (columnNames.includes("football_data_id") && !columnNames.includes("external_match_id")) {
  db.exec("ALTER TABLE matches RENAME COLUMN football_data_id TO external_match_id");
}

// Track which API source the external_match_id points at, so a future dual-source
// setup doesn't need another schema change. Historical rows backfilled to 'football-data'.
columnNames = readColumns();
if (!columnNames.includes("external_source")) {
  db.exec("ALTER TABLE matches ADD COLUMN external_source TEXT");
  db.exec("UPDATE matches SET external_source = 'football-data' WHERE external_match_id IS NOT NULL AND external_source IS NULL");
}

columnNames = readColumns();
if (!columnNames.includes("home_team_id")) {
  db.exec("ALTER TABLE matches ADD COLUMN home_team_id INTEGER");
}
if (!columnNames.includes("away_team_id")) {
  db.exec("ALTER TABLE matches ADD COLUMN away_team_id INTEGER");
}
if (!columnNames.includes("home_formation")) {
  db.exec("ALTER TABLE matches ADD COLUMN home_formation TEXT");
}
if (!columnNames.includes("away_formation")) {
  db.exec("ALTER TABLE matches ADD COLUMN away_formation TEXT");
}

// Detail tables
db.exec(`
  CREATE TABLE IF NOT EXISTS match_goals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    minute INTEGER NOT NULL,
    team TEXT NOT NULL,
    scorer_name TEXT NOT NULL,
    assist_name TEXT,
    type TEXT
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS match_substitutions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    minute INTEGER NOT NULL,
    team TEXT NOT NULL,
    player_out TEXT NOT NULL,
    player_in TEXT NOT NULL
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS match_lineups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    team TEXT NOT NULL,
    player_name TEXT NOT NULL,
    position TEXT,
    shirt_number INTEGER,
    is_starter INTEGER NOT NULL DEFAULT 1
  )
`);

const lineupColumns = (db.prepare("PRAGMA table_info(match_lineups)").all() as { name: string }[]).map((c) => c.name);
if (!lineupColumns.includes("player_id")) {
  db.exec("ALTER TABLE match_lineups ADD COLUMN player_id INTEGER");
}
if (!lineupColumns.includes("grid_position")) {
  db.exec("ALTER TABLE match_lineups ADD COLUMN grid_position TEXT");
}

const subColumns = (db.prepare("PRAGMA table_info(match_substitutions)").all() as { name: string }[]).map((c) => c.name);
if (!subColumns.includes("player_out_id")) {
  db.exec("ALTER TABLE match_substitutions ADD COLUMN player_out_id INTEGER");
}
if (!subColumns.includes("player_in_id")) {
  db.exec("ALTER TABLE match_substitutions ADD COLUMN player_in_id INTEGER");
}

const goalColumns = (db.prepare("PRAGMA table_info(match_goals)").all() as { name: string }[]).map((c) => c.name);
if (!goalColumns.includes("scorer_id")) {
  db.exec("ALTER TABLE match_goals ADD COLUMN scorer_id INTEGER");
}
if (!goalColumns.includes("assist_id")) {
  db.exec("ALTER TABLE match_goals ADD COLUMN assist_id INTEGER");
}

db.exec(`
  CREATE TABLE IF NOT EXISTS players (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    nationality TEXT,
    country_code TEXT,
    photo TEXT,
    fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS teams (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    country TEXT,
    country_code TEXT,
    logo TEXT,
    fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

// One-shot migration (user_version=1): once scorer_id/assist_id columns exist,
// force a re-fetch of every api-football match so we pick up the IDs for goal events.
// Uses SQLite's user_version pragma (not the schema-drift block below) to guarantee
// it runs exactly once — otherwise rows whose API payload legitimately returns null
// IDs would trigger a re-fetch on every server restart.
const userVersion = db.pragma("user_version", { simple: true }) as number;
if (userVersion < 1) {
  db.exec(`
    UPDATE matches
    SET details_fetched = 0
    WHERE details_fetched = 1 AND external_source = 'api-football'
  `);
  db.exec(`DELETE FROM match_goals WHERE match_id IN (SELECT id FROM matches WHERE details_fetched = 0 AND external_source = 'api-football')`);
  db.exec(`DELETE FROM match_substitutions WHERE match_id IN (SELECT id FROM matches WHERE details_fetched = 0 AND external_source = 'api-football')`);
  db.exec(`DELETE FROM match_lineups WHERE match_id IN (SELECT id FROM matches WHERE details_fetched = 0 AND external_source = 'api-football')`);
  db.pragma("user_version = 1");
}

// Re-hydrate lazy-fetched details for api-football matches that predate either the formation/grid
// capture or the substitution player_id capture, so the next visit triggers a re-fetch with the
// richer payload. Skipping rows without a drift signal avoids touching legacy football-data rows
// (which cannot be re-fetched) and already-current rows.
db.exec(`
  UPDATE matches
  SET details_fetched = 0
  WHERE details_fetched = 1
    AND external_source = 'api-football'
    AND (
      home_formation IS NULL
      OR EXISTS (
        SELECT 1 FROM match_substitutions s
        WHERE s.match_id = matches.id AND s.player_in_id IS NULL
      )
    )
`);
db.exec(`
  DELETE FROM match_goals WHERE match_id IN (
    SELECT id FROM matches WHERE details_fetched = 0 AND external_source = 'api-football'
  )
`);
db.exec(`
  DELETE FROM match_substitutions WHERE match_id IN (
    SELECT id FROM matches WHERE details_fetched = 0 AND external_source = 'api-football'
  )
`);
db.exec(`
  DELETE FROM match_lineups WHERE match_id IN (
    SELECT id FROM matches WHERE details_fetched = 0 AND external_source = 'api-football'
  )
`);

export interface Match {
  id: string;
  home_team: string;
  away_team: string;
  home_score: number;
  away_score: number;
  competition: string | null;
  round: string | null;
  date: string;
  venue: string | null;
  home_crest: string | null;
  away_crest: string | null;
  external_match_id: number | null;
  external_source: string | null;
  watch_intervals: string;
  details_fetched: number;
  created_at: string;
  home_team_id: number | null;
  away_team_id: number | null;
  home_formation: string | null;
  away_formation: string | null;
}

export interface MatchGoal {
  id: number;
  match_id: string;
  minute: number;
  team: string;
  scorer_name: string;
  assist_name: string | null;
  type: string | null;
  scorer_id: number | null;
  assist_id: number | null;
}

export interface MatchSubstitution {
  id: number;
  match_id: string;
  minute: number;
  team: string;
  player_out: string;
  player_in: string;
  player_out_id: number | null;
  player_in_id: number | null;
}

export interface MatchLineup {
  id: number;
  match_id: string;
  team: string;
  player_name: string;
  position: string | null;
  shirt_number: number | null;
  is_starter: number;
  player_id: number | null;
  grid_position: string | null;
}

export function getAllMatches(): Match[] {
  return db.prepare("SELECT * FROM matches ORDER BY date DESC, created_at DESC").all() as Match[];
}

export function getMatch(id: string): Match | undefined {
  return db.prepare("SELECT * FROM matches WHERE id = ?").get(id) as Match | undefined;
}

export function createMatch(data: {
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  competition?: string;
  round?: string;
  date: string;
  venue?: string;
  homeCrest?: string;
  awayCrest?: string;
  externalMatchId?: number;
  externalSource?: string;
  watchIntervals?: number[][];
  homeTeamId?: number;
  awayTeamId?: number;
}): Match {
  const id = crypto.randomUUID();
  const intervals = JSON.stringify(data.watchIntervals ?? [[0, 90]]);
  const source = data.externalMatchId != null ? (data.externalSource ?? "api-football") : null;
  const stmt = db.prepare(`
    INSERT INTO matches (id, home_team, away_team, home_score, away_score, competition, round, date, venue, home_crest, away_crest, external_match_id, external_source, watch_intervals, home_team_id, away_team_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    id, data.homeTeam, data.awayTeam, data.homeScore, data.awayScore,
    data.competition || null, data.round || null, data.date, data.venue || null,
    data.homeCrest || null, data.awayCrest || null,
    data.externalMatchId ?? null, source, intervals,
    data.homeTeamId ?? null, data.awayTeamId ?? null
  );
  return db.prepare("SELECT * FROM matches WHERE id = ?").get(id) as Match;
}

export function updateWatchIntervals(matchId: string, intervals: number[][]): void {
  db.prepare("UPDATE matches SET watch_intervals = ? WHERE id = ?").run(JSON.stringify(intervals), matchId);
}

export function saveMatchDetails(
  matchId: string,
  goals: Omit<MatchGoal, "id" | "match_id">[],
  substitutions: Omit<MatchSubstitution, "id" | "match_id">[],
  lineups: Omit<MatchLineup, "id" | "match_id">[],
  meta?: {
    homeFormation?: string | null;
    awayFormation?: string | null;
    homeTeamId?: number | null;
    awayTeamId?: number | null;
  }
): void {
  const insertGoal = db.prepare(
    "INSERT INTO match_goals (match_id, minute, team, scorer_name, assist_name, type, scorer_id, assist_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  );
  const insertSub = db.prepare(
    "INSERT INTO match_substitutions (match_id, minute, team, player_out, player_in, player_out_id, player_in_id) VALUES (?, ?, ?, ?, ?, ?, ?)"
  );
  const insertLineup = db.prepare(
    "INSERT INTO match_lineups (match_id, team, player_name, position, shirt_number, is_starter, player_id, grid_position) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  );

  const transaction = db.transaction(() => {
    for (const g of goals) {
      insertGoal.run(
        matchId, g.minute, g.team, g.scorer_name, g.assist_name ?? null, g.type ?? null,
        g.scorer_id ?? null, g.assist_id ?? null
      );
    }
    for (const s of substitutions) {
      insertSub.run(
        matchId, s.minute, s.team, s.player_out, s.player_in,
        s.player_out_id ?? null, s.player_in_id ?? null
      );
    }
    for (const l of lineups) {
      insertLineup.run(
        matchId, l.team, l.player_name, l.position ?? null, l.shirt_number ?? null, l.is_starter,
        l.player_id ?? null, l.grid_position ?? null
      );
    }
    if (meta) {
      db.prepare(
        "UPDATE matches SET details_fetched = 1, home_formation = ?, away_formation = ?, home_team_id = COALESCE(?, home_team_id), away_team_id = COALESCE(?, away_team_id) WHERE id = ?"
      ).run(
        meta.homeFormation ?? null,
        meta.awayFormation ?? null,
        meta.homeTeamId ?? null,
        meta.awayTeamId ?? null,
        matchId
      );
    } else {
      db.prepare("UPDATE matches SET details_fetched = 1 WHERE id = ?").run(matchId);
    }
  });

  transaction();
}

export function getMatchDetails(matchId: string): {
  goals: MatchGoal[];
  substitutions: MatchSubstitution[];
  lineups: MatchLineup[];
} {
  return {
    goals: db.prepare("SELECT * FROM match_goals WHERE match_id = ? ORDER BY minute").all(matchId) as MatchGoal[],
    substitutions: db.prepare("SELECT * FROM match_substitutions WHERE match_id = ? ORDER BY minute").all(matchId) as MatchSubstitution[],
    lineups: db.prepare("SELECT * FROM match_lineups WHERE match_id = ? ORDER BY team, is_starter DESC, position, player_name").all(matchId) as MatchLineup[],
  };
}

export function getMatchesWithDetails(): (Match & {
  goals: MatchGoal[];
  substitutions: MatchSubstitution[];
  lineups: MatchLineup[];
})[] {
  const matches = db.prepare("SELECT * FROM matches WHERE details_fetched = 1").all() as Match[];
  return matches.map((m) => ({
    ...m,
    ...getMatchDetails(m.id),
  }));
}

export function deleteMatch(id: string): void {
  db.prepare("DELETE FROM matches WHERE id = ?").run(id);
}

export interface PlayerRecord {
  id: number;
  name: string;
  nationality: string | null;
  country_code: string | null;
  photo: string | null;
  fetched_at: string;
}

export function getPlayers(ids: number[]): Map<number, PlayerRecord> {
  const map = new Map<number, PlayerRecord>();
  if (ids.length === 0) return map;
  const placeholders = ids.map(() => "?").join(",");
  const rows = db
    .prepare(`SELECT * FROM players WHERE id IN (${placeholders})`)
    .all(...ids) as PlayerRecord[];
  for (const row of rows) map.set(row.id, row);
  return map;
}

export function upsertPlayer(record: {
  id: number;
  name: string;
  nationality: string | null;
  countryCode: string | null;
  photo: string | null;
}): void {
  db.prepare(
    `INSERT INTO players (id, name, nationality, country_code, photo, fetched_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       nationality = excluded.nationality,
       country_code = excluded.country_code,
       photo = excluded.photo,
       fetched_at = excluded.fetched_at`
  ).run(record.id, record.name, record.nationality, record.countryCode, record.photo);
}

export interface TeamRecord {
  id: number;
  name: string;
  country: string | null;
  country_code: string | null;
  logo: string | null;
  fetched_at: string;
}

export function getTeams(ids: number[]): Map<number, TeamRecord> {
  const map = new Map<number, TeamRecord>();
  if (ids.length === 0) return map;
  const placeholders = ids.map(() => "?").join(",");
  const rows = db
    .prepare(`SELECT * FROM teams WHERE id IN (${placeholders})`)
    .all(...ids) as TeamRecord[];
  for (const row of rows) map.set(row.id, row);
  return map;
}

export function upsertTeam(record: {
  id: number;
  name: string;
  country: string | null;
  countryCode: string | null;
  logo: string | null;
}): void {
  db.prepare(
    `INSERT INTO teams (id, name, country, country_code, logo, fetched_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       country = excluded.country,
       country_code = excluded.country_code,
       logo = excluded.logo,
       fetched_at = excluded.fetched_at`
  ).run(record.id, record.name, record.country, record.countryCode, record.logo);
}
