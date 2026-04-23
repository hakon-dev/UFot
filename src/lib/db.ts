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
if (!columnNames.includes("competition_id")) {
  db.exec("ALTER TABLE matches ADD COLUMN competition_id INTEGER");
}
if (!columnNames.includes("venue_id")) {
  db.exec("ALTER TABLE matches ADD COLUMN venue_id INTEGER");
}
if (!columnNames.includes("venue_city")) {
  db.exec("ALTER TABLE matches ADD COLUMN venue_city TEXT");
}
if (!columnNames.includes("watched_in_person")) {
  db.exec("ALTER TABLE matches ADD COLUMN watched_in_person INTEGER DEFAULT 0");
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

db.exec(`
  CREATE TABLE IF NOT EXISTS match_cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    minute INTEGER NOT NULL,
    team TEXT NOT NULL,
    player_name TEXT NOT NULL,
    player_id INTEGER,
    card_type TEXT NOT NULL
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

const playerColumns = (db.prepare("PRAGMA table_info(players)").all() as { name: string }[]).map((c) => c.name);
if (!playerColumns.includes("position")) {
  db.exec("ALTER TABLE players ADD COLUMN position TEXT");
}
if (!playerColumns.includes("shirt_number")) {
  db.exec("ALTER TABLE players ADD COLUMN shirt_number INTEGER");
}

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

const teamColumns = (db.prepare("PRAGMA table_info(teams)").all() as { name: string }[]).map((c) => c.name);
if (!teamColumns.includes("national")) {
  db.exec("ALTER TABLE teams ADD COLUMN national INTEGER");
}

db.exec(`
  CREATE TABLE IF NOT EXISTS competitions (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    country TEXT,
    country_code TEXT,
    logo TEXT,
    fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS player_transfers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id INTEGER NOT NULL,
    transfer_date TEXT NOT NULL,
    type TEXT,
    team_in_id INTEGER,
    team_in_name TEXT,
    team_in_logo TEXT,
    team_out_id INTEGER,
    team_out_name TEXT,
    team_out_logo TEXT,
    fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_player_transfers_player ON player_transfers(player_id)`);

// Track when we last fetched a player's transfers, separate from the players cache, so we can
// distinguish "never fetched" (empty because no request made) from "fetched, player has no
// transfers on record". Without this we'd re-fetch empty histories on every page view.
db.exec(`
  CREATE TABLE IF NOT EXISTS player_transfer_fetches (
    player_id INTEGER PRIMARY KEY,
    fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

// One-shot migrations using SQLite's user_version pragma (not the schema-drift block below) —
// guarantees each runs exactly once. Without this, rows whose API payload legitimately returns
// null IDs (or no cards) would trigger a re-fetch on every server restart.
//   v1 — scorer_id/assist_id landed; force a re-fetch so existing rows pick them up.
//   v2 — match_cards table added; force a re-fetch so existing rows get card events.
//   v3 — player-name resolution switched from raw `firstname + ' ' + lastname` (which produced
//        legal-full-name forms like "Luke Paul Hoare Shaw") to `expandAbbreviatedName`. Wipe the
//        players cache so future /players/profiles fetches repopulate with the commonly-used
//        form. enrichPlayerStatsWithNationality then fills it back in, bounded by its budget.
//   v4 — `expandAbbreviatedName` now keeps the abbreviation when `firstname[0]` doesn't match
//        the abbreviation's initial (Harry Maguire's legal firstname is "Jacob" → "H. Maguire"
//        shouldn't become "Jacob Maguire"). Wipe the players cache again so entries written
//        under the prior logic are re-fetched.
//   v5 — `fetchPlayerProfile` now falls back to `/players?id=X&season=Y` when expansion can't
//        recover the common name from firstname. Wipe the players cache so Harry-Maguire-style
//        entries try the new fallback path.
//   v6 — `expandAbbreviatedName` now scans ALL words in firstname (which may contain multiple
//        given names like "Jacob Harry" for Harry Maguire) rather than just the first word.
//        Wipe the players cache so mismatched entries re-run through the new scan.
//   v7 — the `national` column was added by ALTER TABLE, leaving pre-existing rows with
//        `national = NULL`. `nationalTeamIds()` only returns `national = 1`, so those stale
//        rows were treated as non-national and national teams slipped into the Most Watched
//        Players "club" column. Delete them so the next enrichment pass re-fetches with the
//        flag set correctly.
const userVersion = db.pragma("user_version", { simple: true }) as number;
if (userVersion < 2) {
  db.exec(`
    UPDATE matches
    SET details_fetched = 0
    WHERE details_fetched = 1 AND external_source = 'api-football'
  `);
  db.exec(`DELETE FROM match_goals WHERE match_id IN (SELECT id FROM matches WHERE details_fetched = 0 AND external_source = 'api-football')`);
  db.exec(`DELETE FROM match_substitutions WHERE match_id IN (SELECT id FROM matches WHERE details_fetched = 0 AND external_source = 'api-football')`);
  db.exec(`DELETE FROM match_lineups WHERE match_id IN (SELECT id FROM matches WHERE details_fetched = 0 AND external_source = 'api-football')`);
  db.exec(`DELETE FROM match_cards WHERE match_id IN (SELECT id FROM matches WHERE details_fetched = 0 AND external_source = 'api-football')`);
  db.pragma("user_version = 2");
}
if (userVersion < 6) {
  db.exec(`DELETE FROM players`);
  db.pragma("user_version = 6");
}
if (userVersion < 7) {
  db.exec(`DELETE FROM teams WHERE national IS NULL`);
  db.pragma("user_version = 7");
}

// NOTE: A prior "schema-drift re-hydrate" block lived here that checked for null
// home_formation or any sub with null player_in_id and purged the match's details so the
// next visit would re-fetch. It was a bug: the API legitimately returns null for these
// fields on some matches (players not in the API's database, or formations it doesn't
// know), so the predicate fired on every single db.ts import, wiping cleanly-hydrated
// matches over and over. The net effect was that a set of "unlucky" matches (e.g. Norway
// vs Switzerland 2026-03-31, Everton vs Man United) never stayed hydrated — their players
// were permanently missing from stats. Use `user_version` bumps (see above) for one-shot
// schema migrations instead; those run exactly once.

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
  competition_id: number | null;
  venue_id: number | null;
  venue_city: string | null;
  watched_in_person: number;
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

export interface MatchCard {
  id: number;
  match_id: string;
  minute: number;
  team: string;
  player_name: string;
  player_id: number | null;
  card_type: string; // 'YELLOW' | 'RED' | 'YELLOWRED'
}

export function getAllMatches(): Match[] {
  return db.prepare("SELECT * FROM matches ORDER BY date DESC, created_at DESC").all() as Match[];
}

export function getMatch(id: string): Match | undefined {
  return db.prepare("SELECT * FROM matches WHERE id = ?").get(id) as Match | undefined;
}

export function getMatchByExternalId(
  externalMatchId: number,
  externalSource: string = "api-football"
): Match | undefined {
  return db
    .prepare(
      "SELECT * FROM matches WHERE external_match_id = ? AND external_source = ?"
    )
    .get(externalMatchId, externalSource) as Match | undefined;
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
  competitionId?: number;
  venueId?: number;
  venueCity?: string;
  watchedInPerson?: boolean;
}): Match {
  const id = crypto.randomUUID();
  const intervals = JSON.stringify(data.watchIntervals ?? [[0, 90]]);
  const source = data.externalMatchId != null ? (data.externalSource ?? "api-football") : null;
  const stmt = db.prepare(`
    INSERT INTO matches (id, home_team, away_team, home_score, away_score, competition, round, date, venue, home_crest, away_crest, external_match_id, external_source, watch_intervals, home_team_id, away_team_id, competition_id, venue_id, venue_city, watched_in_person)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    id, data.homeTeam, data.awayTeam, data.homeScore, data.awayScore,
    data.competition || null, data.round || null, data.date, data.venue || null,
    data.homeCrest || null, data.awayCrest || null,
    data.externalMatchId ?? null, source, intervals,
    data.homeTeamId ?? null, data.awayTeamId ?? null,
    data.competitionId ?? null,
    data.venueId ?? null, data.venueCity || null,
    data.watchedInPerson ? 1 : 0
  );
  return db.prepare("SELECT * FROM matches WHERE id = ?").get(id) as Match;
}

export function updateWatchIntervals(matchId: string, intervals: number[][]): void {
  db.prepare("UPDATE matches SET watch_intervals = ? WHERE id = ?").run(JSON.stringify(intervals), matchId);
}

export function updateMatchWatchedInPerson(matchId: string, watched: boolean): void {
  db.prepare("UPDATE matches SET watched_in_person = ? WHERE id = ?").run(watched ? 1 : 0, matchId);
}

export function getMatchesByVenueId(venueId: number): Match[] {
  return db
    .prepare("SELECT * FROM matches WHERE venue_id = ? ORDER BY date DESC, created_at DESC")
    .all(venueId) as Match[];
}

export interface StadiumAggregate {
  venueId: number;
  venueName: string;
  venueCity: string | null;
  totalMatches: number;
  totalMinutes: number;
  inPersonMatches: number;
  inPersonMinutes: number;
  firstVisit: string | null;
  lastVisit: string | null;
}

export function getStadiumAggregates(): StadiumAggregate[] {
  const rows = db
    .prepare(
      `SELECT venue_id, venue, venue_city, watch_intervals, watched_in_person, date
       FROM matches WHERE venue_id IS NOT NULL`
    )
    .all() as Array<{
      venue_id: number;
      venue: string | null;
      venue_city: string | null;
      watch_intervals: string | null;
      watched_in_person: number;
      date: string;
    }>;

  const map = new Map<number, StadiumAggregate>();
  for (const r of rows) {
    const intervals: number[][] = (() => {
      try {
        return JSON.parse(r.watch_intervals || "[[0,90]]");
      } catch {
        return [[0, 90]];
      }
    })();
    const mins = intervals.reduce((s, [a, b]) => s + (b - a), 0);
    const inPerson = r.watched_in_person === 1;
    let agg = map.get(r.venue_id);
    if (!agg) {
      agg = {
        venueId: r.venue_id,
        venueName: r.venue || "Unknown",
        venueCity: r.venue_city,
        totalMatches: 0,
        totalMinutes: 0,
        inPersonMatches: 0,
        inPersonMinutes: 0,
        firstVisit: null,
        lastVisit: null,
      };
      map.set(r.venue_id, agg);
    } else if (!agg.venueCity && r.venue_city) {
      agg.venueCity = r.venue_city;
    }
    agg.totalMatches += 1;
    agg.totalMinutes += mins;
    if (inPerson) {
      agg.inPersonMatches += 1;
      agg.inPersonMinutes += mins;
    }
    if (!agg.firstVisit || r.date < agg.firstVisit) agg.firstVisit = r.date;
    if (!agg.lastVisit || r.date > agg.lastVisit) agg.lastVisit = r.date;
  }
  return [...map.values()];
}

export function saveMatchDetails(
  matchId: string,
  goals: Omit<MatchGoal, "id" | "match_id">[],
  substitutions: Omit<MatchSubstitution, "id" | "match_id">[],
  lineups: Omit<MatchLineup, "id" | "match_id">[],
  cards: Omit<MatchCard, "id" | "match_id">[],
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
  const insertCard = db.prepare(
    "INSERT INTO match_cards (match_id, minute, team, player_name, player_id, card_type) VALUES (?, ?, ?, ?, ?, ?)"
  );

  const transaction = db.transaction(() => {
    // Idempotent: clear any stale detail rows for this match before inserting. Without this,
    // two racing hydration paths (POST-time + stats-page rescue, or concurrent detail-page
    // opens) both read `details_fetched=0` and both insert, producing duplicate lineup/goal
    // rows that inflate player stats.
    db.prepare("DELETE FROM match_goals WHERE match_id = ?").run(matchId);
    db.prepare("DELETE FROM match_substitutions WHERE match_id = ?").run(matchId);
    db.prepare("DELETE FROM match_lineups WHERE match_id = ?").run(matchId);
    db.prepare("DELETE FROM match_cards WHERE match_id = ?").run(matchId);

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
    for (const c of cards) {
      insertCard.run(
        matchId, c.minute, c.team, c.player_name, c.player_id ?? null, c.card_type
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
  cards: MatchCard[];
} {
  return {
    goals: db.prepare("SELECT * FROM match_goals WHERE match_id = ? ORDER BY minute").all(matchId) as MatchGoal[],
    substitutions: db.prepare("SELECT * FROM match_substitutions WHERE match_id = ? ORDER BY minute").all(matchId) as MatchSubstitution[],
    lineups: db.prepare("SELECT * FROM match_lineups WHERE match_id = ? ORDER BY team, is_starter DESC, position, player_name").all(matchId) as MatchLineup[],
    cards: db.prepare("SELECT * FROM match_cards WHERE match_id = ? ORDER BY minute").all(matchId) as MatchCard[],
  };
}

export function getMatchesWithDetails(): (Match & {
  goals: MatchGoal[];
  substitutions: MatchSubstitution[];
  lineups: MatchLineup[];
  cards: MatchCard[];
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

export function getPendingHydrationIds(limit: number): string[] {
  const rows = db
    .prepare(
      `SELECT id FROM matches
       WHERE details_fetched = 0
         AND external_source = 'api-football'
         AND external_match_id IS NOT NULL
       ORDER BY date DESC
       LIMIT ?`
    )
    .all(limit) as { id: string }[];
  return rows.map((r) => r.id);
}

export interface PlayerRecord {
  id: number;
  name: string;
  nationality: string | null;
  country_code: string | null;
  photo: string | null;
  position: string | null;
  shirt_number: number | null;
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

export function getAllCachedPlayers(): PlayerRecord[] {
  return db.prepare("SELECT * FROM players").all() as PlayerRecord[];
}

export function upsertPlayer(record: {
  id: number;
  name: string;
  nationality: string | null;
  countryCode: string | null;
  photo: string | null;
  position: string | null;
  shirtNumber: number | null;
}): void {
  db.prepare(
    `INSERT INTO players (id, name, nationality, country_code, photo, position, shirt_number, fetched_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       nationality = excluded.nationality,
       country_code = excluded.country_code,
       photo = excluded.photo,
       position = excluded.position,
       shirt_number = excluded.shirt_number,
       fetched_at = excluded.fetched_at`
  ).run(
    record.id, record.name, record.nationality, record.countryCode, record.photo,
    record.position, record.shirtNumber
  );
}

export interface TeamRecord {
  id: number;
  name: string;
  country: string | null;
  country_code: string | null;
  logo: string | null;
  national: number | null;
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
  national: boolean | null;
}): void {
  db.prepare(
    `INSERT INTO teams (id, name, country, country_code, logo, national, fetched_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       country = excluded.country,
       country_code = excluded.country_code,
       logo = excluded.logo,
       national = excluded.national,
       fetched_at = excluded.fetched_at`
  ).run(
    record.id, record.name, record.country, record.countryCode, record.logo,
    record.national == null ? null : record.national ? 1 : 0
  );
}

export interface CompetitionRecord {
  id: number;
  name: string;
  country: string | null;
  country_code: string | null;
  logo: string | null;
  fetched_at: string;
}

export function getCompetitions(ids: number[]): Map<number, CompetitionRecord> {
  const map = new Map<number, CompetitionRecord>();
  if (ids.length === 0) return map;
  const placeholders = ids.map(() => "?").join(",");
  const rows = db
    .prepare(`SELECT * FROM competitions WHERE id IN (${placeholders})`)
    .all(...ids) as CompetitionRecord[];
  for (const row of rows) map.set(row.id, row);
  return map;
}

export function getCompetition(id: number): CompetitionRecord | undefined {
  return db.prepare("SELECT * FROM competitions WHERE id = ?").get(id) as CompetitionRecord | undefined;
}

export function getCompetitionsByCountryCode(code: string): CompetitionRecord[] {
  return db
    .prepare("SELECT * FROM competitions WHERE country_code = ? ORDER BY name")
    .all(code) as CompetitionRecord[];
}

export function getTeamsByCountryCode(code: string): TeamRecord[] {
  return db
    .prepare("SELECT * FROM teams WHERE country_code = ? ORDER BY name")
    .all(code) as TeamRecord[];
}

// Returns the set of team IDs (among the given ids) that are flagged as national teams.
// Unknown ids (no cached team row) are treated as non-national.
export function nationalTeamIds(ids: number[]): Set<number> {
  const out = new Set<number>();
  if (ids.length === 0) return out;
  const placeholders = ids.map(() => "?").join(",");
  const rows = db
    .prepare(`SELECT id FROM teams WHERE national = 1 AND id IN (${placeholders})`)
    .all(...ids) as { id: number }[];
  for (const r of rows) out.add(r.id);
  return out;
}

export function upsertCompetition(record: {
  id: number;
  name: string;
  country: string | null;
  countryCode: string | null;
  logo: string | null;
}): void {
  db.prepare(
    `INSERT INTO competitions (id, name, country, country_code, logo, fetched_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       country = excluded.country,
       country_code = excluded.country_code,
       logo = excluded.logo,
       fetched_at = excluded.fetched_at`
  ).run(
    record.id, record.name, record.country, record.countryCode, record.logo
  );
}

export interface PlayerTransferRecord {
  id: number;
  player_id: number;
  transfer_date: string;
  type: string | null;
  team_in_id: number | null;
  team_in_name: string | null;
  team_in_logo: string | null;
  team_out_id: number | null;
  team_out_name: string | null;
  team_out_logo: string | null;
  fetched_at: string;
}

export function getPlayerTransfers(playerId: number): PlayerTransferRecord[] {
  return db
    .prepare("SELECT * FROM player_transfers WHERE player_id = ? ORDER BY transfer_date DESC")
    .all(playerId) as PlayerTransferRecord[];
}

export function hasFetchedPlayerTransfers(playerId: number): boolean {
  const row = db
    .prepare("SELECT 1 AS x FROM player_transfer_fetches WHERE player_id = ?")
    .get(playerId) as { x: number } | undefined;
  return row != null;
}

export function fetchedPlayerTransferIds(playerIds: number[]): Set<number> {
  const out = new Set<number>();
  if (playerIds.length === 0) return out;
  const placeholders = playerIds.map(() => "?").join(",");
  const rows = db
    .prepare(`SELECT player_id FROM player_transfer_fetches WHERE player_id IN (${placeholders})`)
    .all(...playerIds) as { player_id: number }[];
  for (const row of rows) out.add(row.player_id);
  return out;
}

export function replacePlayerTransfers(
  playerId: number,
  transfers: Array<{
    transferDate: string;
    type: string | null;
    teamInId: number | null;
    teamInName: string | null;
    teamInLogo: string | null;
    teamOutId: number | null;
    teamOutName: string | null;
    teamOutLogo: string | null;
  }>
): void {
  const insert = db.prepare(
    `INSERT INTO player_transfers (
       player_id, transfer_date, type,
       team_in_id, team_in_name, team_in_logo,
       team_out_id, team_out_name, team_out_logo, fetched_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
  );
  const markFetched = db.prepare(
    `INSERT INTO player_transfer_fetches (player_id, fetched_at)
     VALUES (?, datetime('now'))
     ON CONFLICT(player_id) DO UPDATE SET fetched_at = excluded.fetched_at`
  );
  const tx = db.transaction(() => {
    db.prepare("DELETE FROM player_transfers WHERE player_id = ?").run(playerId);
    for (const t of transfers) {
      insert.run(
        playerId, t.transferDate, t.type,
        t.teamInId, t.teamInName, t.teamInLogo,
        t.teamOutId, t.teamOutName, t.teamOutLogo
      );
    }
    markFetched.run(playerId);
  });
  tx();
}
