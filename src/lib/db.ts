import Database from "better-sqlite3";
import path from "path";
import crypto from "crypto";

const dbPath = path.join(process.cwd(), "data", "ufot.db");
const db = new Database(dbPath);

// Enable WAL mode for better concurrent read performance
db.pragma("journal_mode = WAL");

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

// Migration: add crest columns if they don't exist
const columns = db.prepare("PRAGMA table_info(matches)").all() as { name: string }[];
const columnNames = columns.map((c) => c.name);
if (!columnNames.includes("home_crest")) {
  db.exec("ALTER TABLE matches ADD COLUMN home_crest TEXT");
}
if (!columnNames.includes("away_crest")) {
  db.exec("ALTER TABLE matches ADD COLUMN away_crest TEXT");
}

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
  created_at: string;
}

export function getAllMatches(): Match[] {
  return db.prepare("SELECT * FROM matches ORDER BY date DESC, created_at DESC").all() as Match[];
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
}): Match {
  const id = crypto.randomUUID();
  const stmt = db.prepare(`
    INSERT INTO matches (id, home_team, away_team, home_score, away_score, competition, round, date, venue, home_crest, away_crest)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(id, data.homeTeam, data.awayTeam, data.homeScore, data.awayScore, data.competition || null, data.round || null, data.date, data.venue || null, data.homeCrest || null, data.awayCrest || null);
  return db.prepare("SELECT * FROM matches WHERE id = ?").get(id) as Match;
}

export function deleteMatch(id: string): void {
  db.prepare("DELETE FROM matches WHERE id = ?").run(id);
}
