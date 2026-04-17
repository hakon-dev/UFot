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
const columns = db.prepare("PRAGMA table_info(matches)").all() as { name: string }[];
const columnNames = columns.map((c) => c.name);
if (!columnNames.includes("home_crest")) {
  db.exec("ALTER TABLE matches ADD COLUMN home_crest TEXT");
}
if (!columnNames.includes("away_crest")) {
  db.exec("ALTER TABLE matches ADD COLUMN away_crest TEXT");
}
if (!columnNames.includes("football_data_id")) {
  db.exec("ALTER TABLE matches ADD COLUMN football_data_id INTEGER");
}
if (!columnNames.includes("watch_intervals")) {
  db.exec("ALTER TABLE matches ADD COLUMN watch_intervals TEXT DEFAULT '[[0,90]]'");
}
if (!columnNames.includes("details_fetched")) {
  db.exec("ALTER TABLE matches ADD COLUMN details_fetched INTEGER DEFAULT 0");
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
  football_data_id: number | null;
  watch_intervals: string;
  details_fetched: number;
  created_at: string;
}

export interface MatchGoal {
  id: number;
  match_id: string;
  minute: number;
  team: string;
  scorer_name: string;
  assist_name: string | null;
  type: string | null;
}

export interface MatchSubstitution {
  id: number;
  match_id: string;
  minute: number;
  team: string;
  player_out: string;
  player_in: string;
}

export interface MatchLineup {
  id: number;
  match_id: string;
  team: string;
  player_name: string;
  position: string | null;
  shirt_number: number | null;
  is_starter: number;
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
  footballDataId?: number;
  watchIntervals?: number[][];
}): Match {
  const id = crypto.randomUUID();
  const intervals = JSON.stringify(data.watchIntervals ?? [[0, 90]]);
  const stmt = db.prepare(`
    INSERT INTO matches (id, home_team, away_team, home_score, away_score, competition, round, date, venue, home_crest, away_crest, football_data_id, watch_intervals)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    id, data.homeTeam, data.awayTeam, data.homeScore, data.awayScore,
    data.competition || null, data.round || null, data.date, data.venue || null,
    data.homeCrest || null, data.awayCrest || null,
    data.footballDataId ?? null, intervals
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
  lineups: Omit<MatchLineup, "id" | "match_id">[]
): void {
  const insertGoal = db.prepare(
    "INSERT INTO match_goals (match_id, minute, team, scorer_name, assist_name, type) VALUES (?, ?, ?, ?, ?, ?)"
  );
  const insertSub = db.prepare(
    "INSERT INTO match_substitutions (match_id, minute, team, player_out, player_in) VALUES (?, ?, ?, ?, ?)"
  );
  const insertLineup = db.prepare(
    "INSERT INTO match_lineups (match_id, team, player_name, position, shirt_number, is_starter) VALUES (?, ?, ?, ?, ?, ?)"
  );

  const transaction = db.transaction(() => {
    for (const g of goals) {
      insertGoal.run(matchId, g.minute, g.team, g.scorer_name, g.assist_name ?? null, g.type ?? null);
    }
    for (const s of substitutions) {
      insertSub.run(matchId, s.minute, s.team, s.player_out, s.player_in);
    }
    for (const l of lineups) {
      insertLineup.run(matchId, l.team, l.player_name, l.position ?? null, l.shirt_number ?? null, l.is_starter);
    }
    db.prepare("UPDATE matches SET details_fetched = 1 WHERE id = ?").run(matchId);
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
