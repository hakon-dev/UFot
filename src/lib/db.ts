import Database from "better-sqlite3";
import path from "path";
import crypto from "crypto";
import { matchGender, type Gender } from "./gender";

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
if (!columnNames.includes("referee_name")) {
  db.exec("ALTER TABLE matches ADD COLUMN referee_name TEXT");
}
if (!columnNames.includes("home_coach_id")) {
  db.exec("ALTER TABLE matches ADD COLUMN home_coach_id INTEGER");
}
if (!columnNames.includes("home_coach_name")) {
  db.exec("ALTER TABLE matches ADD COLUMN home_coach_name TEXT");
}
if (!columnNames.includes("away_coach_id")) {
  db.exec("ALTER TABLE matches ADD COLUMN away_coach_id INTEGER");
}
if (!columnNames.includes("away_coach_name")) {
  db.exec("ALTER TABLE matches ADD COLUMN away_coach_name TEXT");
}
// Extra time / penalty shootout state. `had_extra_time` is set whenever the match went past 90
// minutes (API status AET or PEN); `had_penalties` is set when a shootout was needed (PEN
// only). `watched_penalties` is the user's bit — defaulted to 1 when the user marks the match
// as fully watched at add-time but separately togglable from the match-detail page.
if (!columnNames.includes("had_extra_time")) {
  db.exec("ALTER TABLE matches ADD COLUMN had_extra_time INTEGER DEFAULT 0");
}
if (!columnNames.includes("had_penalties")) {
  db.exec("ALTER TABLE matches ADD COLUMN had_penalties INTEGER DEFAULT 0");
}
if (!columnNames.includes("watched_penalties")) {
  db.exec("ALTER TABLE matches ADD COLUMN watched_penalties INTEGER DEFAULT 0");
}
// `details_fetched` only records that we *tried* to hydrate. `details_complete` records that the
// payload we got back was actually full. Splitting the two lets us retry partially-fetched rows
// (lineups not yet posted, events still trickling in) without making the match invisible to
// stats in the meantime — the row stays `details_fetched=1` so it shows in aggregates, while
// `details_complete=0` keeps it on the rescue loop.
if (!columnNames.includes("details_complete")) {
  db.exec("ALTER TABLE matches ADD COLUMN details_complete INTEGER DEFAULT 0");
}
// Marks that we already attempted a `/venues?search=` lookup for this match's free-text venue
// name. Set after the lookup runs even when no result was found, so the page doesn't burn an
// API call on every view of a match whose venue API-Football doesn't have indexed.
if (!columnNames.includes("venue_search_attempted")) {
  db.exec("ALTER TABLE matches ADD COLUMN venue_search_attempted INTEGER DEFAULT 0");
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
// Second-chance club lookup: for players whose /transfers response is empty, /players?id=X&season=Y
// returns their current team in statistics[].team. Cached here so we don't re-fetch each visit.
if (!playerColumns.includes("current_team_id")) {
  db.exec("ALTER TABLE players ADD COLUMN current_team_id INTEGER");
}
if (!playerColumns.includes("current_team_name")) {
  db.exec("ALTER TABLE players ADD COLUMN current_team_name TEXT");
}
if (!playerColumns.includes("current_team_logo")) {
  db.exec("ALTER TABLE players ADD COLUMN current_team_logo TEXT");
}
if (!playerColumns.includes("current_team_fetched_at")) {
  db.exec("ALTER TABLE players ADD COLUMN current_team_fetched_at TEXT");
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
  CREATE TABLE IF NOT EXISTS coaches (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    photo TEXT,
    nationality TEXT,
    country_code TEXT,
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

// Per-player squad history derived from /players?id=X&season=Y, kept across the seasons we
// already fetch for the current-team fallback. One row per (player, season, team) so a player
// who appeared for two clubs in one season (mid-season transfer, or club + national) gets two
// rows. Used to synthesise tenures when /transfers is empty (Hegerberg, Vinicius, women's
// players where API-Football's transfers endpoint has no coverage).
db.exec(`
  CREATE TABLE IF NOT EXISTS player_seasons (
    player_id INTEGER NOT NULL,
    season INTEGER NOT NULL,
    team_id INTEGER NOT NULL,
    team_name TEXT,
    team_logo TEXT,
    fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (player_id, season, team_id)
  )
`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_player_seasons_player ON player_seasons(player_id)`);

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
//   v8 — `details_complete` column added. Classify every existing api-football row: complete
//        means both teams have at least one starter row AND the saved goal-event count is at
//        least home_score + away_score (Brann vs Aalesund 2026-04-22 was hydrated before
//        lineups had been published; Senegal vs Morocco 2026-01-18 saved 1 of 3 goal events).
//        Both bugs were silent because `details_fetched=1` blocked any retry.
if (userVersion < 8) {
  db.exec(`
    UPDATE matches
    SET details_complete = 1
    WHERE details_fetched = 1
      AND external_source = 'api-football'
      AND EXISTS (
        SELECT 1 FROM match_lineups
        WHERE match_id = matches.id AND team = 'home' AND is_starter = 1
      )
      AND EXISTS (
        SELECT 1 FROM match_lineups
        WHERE match_id = matches.id AND team = 'away' AND is_starter = 1
      )
      AND (
        SELECT COUNT(*) FROM match_goals WHERE match_id = matches.id
      ) >= matches.home_score + matches.away_score
  `);
  db.pragma("user_version = 8");
}
//   v9 — referee + coach columns added on `matches` and a `coaches` cache table introduced.
//        Existing api-football rows have NULL coach/referee fields. Flip details_complete=0
//        so the rescue loop re-hydrates them and picks up the new fields. Each match costs
//        3 API requests; bounded by hydratePendingMatches limits. Rows
//        whose API response still doesn't include a coach (lineups not posted, etc.) will
//        flip back to complete=0 on retry — that's fine, they'll keep the partial data.
if (userVersion < 9) {
  db.exec(`
    UPDATE matches SET details_complete = 0
    WHERE external_source = 'api-football' AND details_fetched = 1
  `);
  db.pragma("user_version = 9");
}
//   v10 — `fetchMatchDetails` now reads `fixture.venue.{id, name, city}` from the existing
//        /fixtures?id=X call and persists it via `saveMatchDetails`. Older rows were hydrated
//        before that path existed, so `venue_id IS NULL` even though the API has the data.
//        Flip details_complete=0 only for those rows so the rescue loop re-hydrates them and
//        backfills the venue. Targeted (vs blanket) to avoid burning API budget on rows that
//        already have venue data.
if (userVersion < 10) {
  db.exec(`
    UPDATE matches SET details_complete = 0
    WHERE external_source = 'api-football'
      AND details_fetched = 1
      AND venue_id IS NULL
  `);
  db.pragma("user_version = 10");
}
//   v11 — Repair matches where API-Football flipped which team is designated "home" between
//        the original fixture listing (when the user added the match) and the post-match
//        details endpoint. Common at neutral-venue national-team games — e.g. the 2025 UEFA
//        Nations League final at Allianz Arena: fixture listing had Portugal=home, the details
//        endpoint flipped to Spain=home, so lineups + coaches got saved with the new home/away
//        designation while the match row stayed on the original. Result: Bruno Fernandes (and
//        every Portugal player) was tagged team='away', which player-attribution code resolves
//        to match.away_team='Spain'. Detection: a national-team match where home-tagged
//        starters' nationalities mostly match the AWAY team's country. Repair: flip lineup
//        team tags and swap home/away coach + formation. Going-forward saves are guarded by
//        the swap-detection block in `saveMatchDetails`. Goals/cards/subs store the team's
//        name (not "home"/"away") so they don't need adjustment.
if (userVersion < 11) {
  const candidates = db
    .prepare(
      `SELECT m.id, th.country_code AS home_cc, ta.country_code AS away_cc
       FROM matches m
       LEFT JOIN teams th ON th.id = m.home_team_id
       LEFT JOIN teams ta ON ta.id = m.away_team_id
       WHERE m.details_fetched = 1
         AND m.home_team_id IS NOT NULL
         AND m.away_team_id IS NOT NULL
         AND th.national = 1 AND ta.national = 1
         AND th.country_code IS NOT NULL AND ta.country_code IS NOT NULL`
    )
    .all() as { id: string; home_cc: string; away_cc: string }[];

  const homeStarterStmt = db.prepare(
    `SELECT p.country_code AS player_cc
     FROM match_lineups ml
     LEFT JOIN players p ON p.id = ml.player_id
     WHERE ml.match_id = ? AND ml.team = 'home' AND ml.is_starter = 1`
  );
  const flipLineupsStmt = db.prepare(
    `UPDATE match_lineups SET team = CASE team WHEN 'home' THEN 'away' ELSE 'home' END WHERE match_id = ?`
  );
  // SQLite UPDATE evaluates every SET expression against the row's pre-update values, so a
  // direct cross-assignment (home := away, away := home) atomically swaps the columns.
  const swapMatchSidesStmt = db.prepare(
    `UPDATE matches SET
       home_coach_id = away_coach_id,
       away_coach_id = home_coach_id,
       home_coach_name = away_coach_name,
       away_coach_name = home_coach_name,
       home_formation = away_formation,
       away_formation = home_formation
     WHERE id = ?`
  );

  for (const m of candidates) {
    const homeStarters = homeStarterStmt.all(m.id) as { player_cc: string | null }[];
    let homeMatch = 0;
    let awayMatch = 0;
    for (const s of homeStarters) {
      if (!s.player_cc) continue;
      if (s.player_cc === m.home_cc) homeMatch++;
      else if (s.player_cc === m.away_cc) awayMatch++;
    }
    if (homeMatch + awayMatch >= 3 && awayMatch > homeMatch) {
      flipLineupsStmt.run(m.id);
      swapMatchSidesStmt.run(m.id);
    }
  }
  db.pragma("user_version = 11");
}
//   v12 — Repair `match_substitutions.team` and `match_cards.team` for events that store the
//        wrong team name. API-Football's events endpoint occasionally returns a `team.name`
//        on substitution events that doesn't match the player's actual team — for the 2025
//        UEFA Nations League final, every Portugal substitution came back tagged 'Spain' and
//        every Spain sub tagged 'Portugal' (independent of the home/away inversion that v11
//        addressed). Cards weren't observed wrong in that match but the same API anomaly
//        could affect them, so we repair both. Goals are intentionally skipped: own goals are
//        legitimately credited to the OPPOSITE team from the kicker, so a player_id → team
//        rebuild would corrupt them. Method: for each sub, look up `player_out_id` (preferred)
//        or `player_in_id` (fallback) in `match_lineups` for the same match. The lineup row's
//        `team` ('home'/'away') maps to the match's `home_team` or `away_team` name. For each
//        card, look up `player_id`. Idempotent: rows whose team is already correct just get
//        rewritten to the same value. Going-forward saves are guarded by a post-insert pass
//        in `saveMatchDetails`.
if (userVersion < 12) {
  db.exec(
    `UPDATE match_substitutions
     SET team = (
       SELECT CASE ml.team WHEN 'home' THEN m.home_team ELSE m.away_team END
       FROM match_lineups ml
       JOIN matches m ON m.id = ml.match_id
       WHERE ml.match_id = match_substitutions.match_id
         AND ml.player_id IS NOT NULL
         AND ml.player_id = COALESCE(match_substitutions.player_out_id, match_substitutions.player_in_id)
       LIMIT 1
     )
     WHERE EXISTS (
       SELECT 1 FROM match_lineups ml
       WHERE ml.match_id = match_substitutions.match_id
         AND ml.player_id IS NOT NULL
         AND ml.player_id = COALESCE(match_substitutions.player_out_id, match_substitutions.player_in_id)
     )`
  );
  db.exec(
    `UPDATE match_cards
     SET team = (
       SELECT CASE ml.team WHEN 'home' THEN m.home_team ELSE m.away_team END
       FROM match_lineups ml
       JOIN matches m ON m.id = ml.match_id
       WHERE ml.match_id = match_cards.match_id
         AND ml.player_id IS NOT NULL
         AND ml.player_id = match_cards.player_id
       LIMIT 1
     )
     WHERE match_cards.player_id IS NOT NULL
       AND EXISTS (
         SELECT 1 FROM match_lineups ml
         WHERE ml.match_id = match_cards.match_id
           AND ml.player_id IS NOT NULL
           AND ml.player_id = match_cards.player_id
       )`
  );
  db.pragma("user_version = 12");
}

// v13: backfill matches.competition_id from matches.competition (text name) for legacy rows.
// Older matches predate the competition_id column and only carry the competition name. The
// home-feed JOIN keys on competition_id, so without this migration their cards never render
// a competition logo (only the few most recent matches do). Picks the candidate with the most
// existing competition_id matches under that name as a popularity tiebreaker (so "Premier
// League" → 39/England wins over 368/Singapore); falls back to lowest id when nothing in the
// DB references either candidate yet.
if (userVersion < 13) {
  const orphans = db
    .prepare(
      `SELECT DISTINCT competition FROM matches
       WHERE competition_id IS NULL AND competition IS NOT NULL`
    )
    .all() as { competition: string }[];

  for (const { competition } of orphans) {
    const candidates = db
      .prepare(
        `SELECT c.id, COUNT(m.id) AS uses
         FROM competitions c
         LEFT JOIN matches m ON m.competition_id = c.id
         WHERE c.name = ?
         GROUP BY c.id
         ORDER BY uses DESC, c.id ASC`
      )
      .all(competition) as { id: number; uses: number }[];
    if (candidates.length === 0) continue;
    const winner = candidates[0].id;
    db.prepare(
      "UPDATE matches SET competition_id = ? WHERE competition_id IS NULL AND competition = ?"
    ).run(winner, competition);
  }
  db.pragma("user_version = 13");
}
//   v14 — `had_extra_time` / `had_penalties` columns were added to track AET/PEN status.
//        Existing api-football rows have `had_extra_time = 0` (the column default), so an
//        AET final added before this feature still renders a 90-minute timeline. Flip
//        details_complete=0 for every api-football row so the rescue loop re-hydrates them
//        and `saveMatchDetails` picks up the AET/PEN flags from the same /fixtures?id=X
//        call we already make. The rescue loop is bounded (5 matches per stats-page visit
//        = 15 API requests) so this drains gradually rather than spiking the budget.
if (userVersion < 14) {
  db.exec(`
    UPDATE matches SET details_complete = 0
    WHERE external_source = 'api-football' AND details_fetched = 1
  `);
  db.pragma("user_version = 14");
}

// v15: undo bad rescue assignments where competition_id was set to a non-priority
// homonym. The earlier home-page rescue picked the first exact-name hit from
// /leagues?search=, so generic cup names ("League Cup", "FA Cup") got assigned to
// whichever country API-Football returned first — Singapore's "League Cup" (id 505)
// rather than England's EFL Cup (id 48). Reset those matches to NULL and drop the
// orphan cache rows; the new disambiguating rescue (page.tsx, prefers
// COMPETITION_PRIORITY) re-resolves them on the next home-page render.
if (userVersion < 15) {
  db.exec(`
    UPDATE matches SET competition_id = NULL
    WHERE competition_id IN (
      SELECT id FROM competitions WHERE id = 505
    )
  `);
  db.prepare("DELETE FROM competitions WHERE id = 505").run();
  db.pragma("user_version = 15");
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
  details_complete: number;
  created_at: string;
  home_team_id: number | null;
  away_team_id: number | null;
  home_formation: string | null;
  away_formation: string | null;
  competition_id: number | null;
  venue_id: number | null;
  venue_city: string | null;
  watched_in_person: number;
  referee_name: string | null;
  home_coach_id: number | null;
  home_coach_name: string | null;
  away_coach_id: number | null;
  away_coach_name: string | null;
  venue_search_attempted: number;
  had_extra_time: number;
  had_penalties: number;
  watched_penalties: number;
  competition_logo?: string | null;
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
  return db
    .prepare(
      `SELECT m.*, c.logo AS competition_logo
       FROM matches m
       LEFT JOIN competitions c ON c.id = m.competition_id
       ORDER BY m.date DESC, m.created_at DESC`
    )
    .all() as Match[];
}

export function getMatch(id: string): Match | undefined {
  return db
    .prepare(
      `SELECT m.*, c.logo AS competition_logo
       FROM matches m
       LEFT JOIN competitions c ON c.id = m.competition_id
       WHERE m.id = ?`
    )
    .get(id) as Match | undefined;
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
  hadExtraTime?: boolean;
  hadPenalties?: boolean;
  watchedPenalties?: boolean;
}): Match {
  const id = crypto.randomUUID();
  const hadExtraTime = data.hadExtraTime === true;
  const defaultIntervals = hadExtraTime ? [[0, 120]] : [[0, 90]];
  const intervals = JSON.stringify(data.watchIntervals ?? defaultIntervals);
  const source = data.externalMatchId != null ? (data.externalSource ?? "api-football") : null;
  const stmt = db.prepare(`
    INSERT INTO matches (id, home_team, away_team, home_score, away_score, competition, round, date, venue, home_crest, away_crest, external_match_id, external_source, watch_intervals, home_team_id, away_team_id, competition_id, venue_id, venue_city, watched_in_person, had_extra_time, had_penalties, watched_penalties)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    id, data.homeTeam, data.awayTeam, data.homeScore, data.awayScore,
    data.competition || null, data.round || null, data.date, data.venue || null,
    data.homeCrest || null, data.awayCrest || null,
    data.externalMatchId ?? null, source, intervals,
    data.homeTeamId ?? null, data.awayTeamId ?? null,
    data.competitionId ?? null,
    data.venueId ?? null, data.venueCity || null,
    data.watchedInPerson ? 1 : 0,
    hadExtraTime ? 1 : 0,
    data.hadPenalties === true ? 1 : 0,
    data.watchedPenalties === true ? 1 : 0
  );
  return db.prepare("SELECT * FROM matches WHERE id = ?").get(id) as Match;
}

export function updateWatchIntervals(matchId: string, intervals: number[][]): void {
  db.prepare("UPDATE matches SET watch_intervals = ? WHERE id = ?").run(JSON.stringify(intervals), matchId);
}

export function updateMatchWatchedInPerson(matchId: string, watched: boolean): void {
  db.prepare("UPDATE matches SET watched_in_person = ? WHERE id = ?").run(watched ? 1 : 0, matchId);
}

export function updateMatchWatchedPenalties(matchId: string, watched: boolean): void {
  db.prepare("UPDATE matches SET watched_penalties = ? WHERE id = ?").run(watched ? 1 : 0, matchId);
}

// Set the resolved venue id for a match (from a `/venues?search=` lookup) and mark the lookup
// as attempted in one go. Always flips `venue_search_attempted=1` so a null result still
// blocks future retries.
export function setMatchVenueId(matchId: string, venueId: number | null): void {
  db.prepare(
    "UPDATE matches SET venue_id = COALESCE(?, venue_id), venue_search_attempted = 1 WHERE id = ?"
  ).run(venueId, matchId);
}

export function setMatchCompetitionId(competitionName: string, competitionId: number): void {
  db.prepare(
    "UPDATE matches SET competition_id = ? WHERE competition_id IS NULL AND competition = ?"
  ).run(competitionId, competitionName);
}

export function getMatchesByVenueId(venueId: number): Match[] {
  return db
    .prepare("SELECT * FROM matches WHERE venue_id = ? ORDER BY date DESC, created_at DESC")
    .all(venueId) as Match[];
}

export function getMatchesBetweenTeams(teamAId: number, teamBId: number): Match[] {
  return db
    .prepare(
      `SELECT * FROM matches
       WHERE (home_team_id = ? AND away_team_id = ?)
          OR (home_team_id = ? AND away_team_id = ?)
       ORDER BY date DESC, created_at DESC`
    )
    .all(teamAId, teamBId, teamBId, teamAId) as Match[];
}

// Most-frequent venue_id for matches where this team was the home side. Used to detect
// neutral-ground meetings on the head-to-head page: if a match's venue isn't the home
// team's regular ground, it's treated as neutral. Returns null when the team has no
// recorded home matches with a venue_id.
export function getTeamHomeVenue(teamId: number): number | null {
  const row = db
    .prepare(
      `SELECT venue_id FROM matches
       WHERE home_team_id = ? AND venue_id IS NOT NULL
       GROUP BY venue_id
       ORDER BY COUNT(*) DESC, venue_id ASC
       LIMIT 1`
    )
    .get(teamId) as { venue_id: number } | undefined;
  return row?.venue_id ?? null;
}

// Name-based fallback for venues that API-Football didn't return an id for (and our
// `/venues?search=` lookup couldn't resolve either). Case-insensitive exact match on the
// free-text `venue` column so manual entries and api-rows-without-id both surface here.
export function getMatchesByVenueName(venueName: string): Match[] {
  return db
    .prepare(
      "SELECT * FROM matches WHERE LOWER(venue) = LOWER(?) ORDER BY date DESC, created_at DESC"
    )
    .all(venueName) as Match[];
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
  gender: Gender;
}

// Local-cache search. LIKE %q% on each table; case-insensitive via LOWER(). Limits are small
// because results render in a Navbar dropdown.

export interface StadiumSearchHit {
  venueId: number;
  venueName: string;
  venueCity: string | null;
}

function likeQuery(q: string): string {
  return `%${q.toLowerCase().replace(/[%_]/g, (c) => "\\" + c)}%`;
}

// Cache search ordering: watched rows first (DESC by appearance count), then alphabetic. The
// teams/players/competitions/coaches caches mix entries that the user has actually watched with
// entries warmed by `/api/search` calls. Without a watched-count tiebreaker, alphabetic ordering
// would stick an un-watched homonym above a Premier League regular.
export function searchTeamsCache(q: string, limit = 8): TeamRecord[] {
  if (!q.trim()) return [];
  return db
    .prepare(
      `SELECT t.*, (
         SELECT COUNT(*) FROM matches m
         WHERE m.home_team_id = t.id OR m.away_team_id = t.id
       ) AS watched_count
       FROM teams t
       WHERE LOWER(t.name) LIKE ? ESCAPE '\\'
       ORDER BY watched_count DESC, t.name
       LIMIT ?`
    )
    .all(likeQuery(q), limit) as TeamRecord[];
}

export function searchPlayersCache(q: string, limit = 8): PlayerRecord[] {
  if (!q.trim()) return [];
  return db
    .prepare(
      `SELECT p.*, (
         SELECT COUNT(DISTINCT match_id) FROM match_lineups l
         WHERE l.player_id = p.id
       ) AS watched_count
       FROM players p
       WHERE LOWER(p.name) LIKE ? ESCAPE '\\'
       ORDER BY watched_count DESC, p.name
       LIMIT ?`
    )
    .all(likeQuery(q), limit) as PlayerRecord[];
}

export function searchCompetitionsCache(q: string, limit = 8): CompetitionRecord[] {
  if (!q.trim()) return [];
  return db
    .prepare(
      `SELECT c.*, (
         SELECT COUNT(*) FROM matches m WHERE m.competition_id = c.id
       ) AS watched_count
       FROM competitions c
       WHERE LOWER(c.name) LIKE ? ESCAPE '\\'
       ORDER BY watched_count DESC, c.name
       LIMIT ?`
    )
    .all(likeQuery(q), limit) as CompetitionRecord[];
}

// Stadiums aren't a first-class cache table — they live as venue_id/venue/venue_city columns on
// matches. Group by venue_id to avoid duplicates from multiple matches at the same ground; rank
// by visit count so a stadium watched five times outranks one watched once.
export function searchStadiumsCache(q: string, limit = 8): StadiumSearchHit[] {
  if (!q.trim()) return [];
  return db
    .prepare(
      `SELECT venue_id AS venueId, venue AS venueName, MAX(venue_city) AS venueCity,
              COUNT(*) AS watched_count
       FROM matches
       WHERE venue_id IS NOT NULL AND LOWER(venue) LIKE ? ESCAPE '\\'
       GROUP BY venue_id, venue
       ORDER BY watched_count DESC, venue
       LIMIT ?`
    )
    .all(likeQuery(q), limit) as StadiumSearchHit[];
}

export function searchCoachesCache(q: string, limit = 8): CoachRecord[] {
  if (!q.trim()) return [];
  return db
    .prepare(
      `SELECT c.*, (
         SELECT COUNT(*) FROM matches m
         WHERE m.home_coach_id = c.id OR m.away_coach_id = c.id
       ) AS watched_count
       FROM coaches c
       WHERE LOWER(c.name) LIKE ? ESCAPE '\\'
       ORDER BY watched_count DESC, c.name
       LIMIT ?`
    )
    .all(likeQuery(q), limit) as CoachRecord[];
}

export interface RefereeSearchHit {
  name: string;
  matches: number;
}

// Referees have no API-Football id and no profile endpoint — the only signal is `fixture.referee`,
// a free-text name we persist on `matches.referee_name`. Aggregate by name with a count so the
// search dropdown can show "John Doe (5 matches)" and link straight to the drill-down.
export function searchRefereesCache(q: string, limit = 8): RefereeSearchHit[] {
  if (!q.trim()) return [];
  return db
    .prepare(
      `SELECT referee_name AS name, COUNT(*) AS matches
       FROM matches
       WHERE referee_name IS NOT NULL AND TRIM(referee_name) <> ''
         AND LOWER(referee_name) LIKE ? ESCAPE '\\'
       GROUP BY referee_name
       ORDER BY matches DESC, referee_name
       LIMIT ?`
    )
    .all(likeQuery(q), limit) as RefereeSearchHit[];
}

export interface CoachAggregate {
  coachId: number;
  name: string;
  photo: string | null;
  matches: number;
  minutes: number;
  wins: number;
  draws: number;
  losses: number;
  firstMatch: string | null;
  lastMatch: string | null;
  gender: Gender;
}

export interface RefereeAggregate {
  name: string;
  matches: number;
  minutes: number;
  firstMatch: string | null;
  lastMatch: string | null;
  gender: Gender;
}

// Walk every match with coach data and accumulate per-coach totals. A coach can show up on the
// home side in some matches and the away side in others (when their team plays both at home and
// away through the season), so we attribute each match to the coach that was on that side.
// Photo is read lazily from the coaches cache to keep the query simple — the table page joins
// on the cache.
export function getCoachAggregates(): CoachAggregate[] {
  const rows = db
    .prepare(
      `SELECT id, home_team, away_team, home_score, away_score, home_coach_id, home_coach_name,
              away_coach_id, away_coach_name, watch_intervals, date
       FROM matches
       WHERE home_coach_id IS NOT NULL OR away_coach_id IS NOT NULL`
    )
    .all() as Array<{
      id: string;
      home_team: string;
      away_team: string;
      home_score: number;
      away_score: number;
      home_coach_id: number | null;
      home_coach_name: string | null;
      away_coach_id: number | null;
      away_coach_name: string | null;
      watch_intervals: string | null;
      date: string;
    }>;

  const map = new Map<number, CoachAggregate>();
  const genderTally = new Map<number, { men: number; women: number }>();

  function tally(
    coachId: number | null,
    coachName: string | null,
    side: "home" | "away",
    homeScore: number,
    awayScore: number,
    minutes: number,
    date: string,
    g: Gender
  ): void {
    if (coachId == null || !coachName) return;
    let agg = map.get(coachId);
    if (!agg) {
      agg = {
        coachId,
        name: coachName,
        photo: null,
        matches: 0,
        minutes: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        firstMatch: null,
        lastMatch: null,
        gender: "men",
      };
      map.set(coachId, agg);
    }
    agg.matches += 1;
    agg.minutes += minutes;
    if (homeScore === awayScore) agg.draws += 1;
    else if ((side === "home" && homeScore > awayScore) || (side === "away" && awayScore > homeScore)) agg.wins += 1;
    else agg.losses += 1;
    if (!agg.firstMatch || date < agg.firstMatch) agg.firstMatch = date;
    if (!agg.lastMatch || date > agg.lastMatch) agg.lastMatch = date;
    const t = genderTally.get(coachId) ?? { men: 0, women: 0 };
    t[g] += minutes;
    genderTally.set(coachId, t);
  }

  for (const r of rows) {
    const intervals: number[][] = (() => {
      try {
        return JSON.parse(r.watch_intervals || "[[0,90]]");
      } catch {
        return [[0, 90]];
      }
    })();
    const minutes = intervals.reduce((s, [a, b]) => s + (b - a), 0);
    const g = matchGender(r.home_team, r.away_team);
    tally(r.home_coach_id, r.home_coach_name, "home", r.home_score, r.away_score, minutes, r.date, g);
    tally(r.away_coach_id, r.away_coach_name, "away", r.home_score, r.away_score, minutes, r.date, g);
  }

  // Backfill photos from the coaches cache so the table can render avatars.
  const ids = [...map.keys()];
  if (ids.length > 0) {
    const placeholders = ids.map(() => "?").join(",");
    const cache = db
      .prepare(`SELECT id, photo FROM coaches WHERE id IN (${placeholders})`)
      .all(...ids) as { id: number; photo: string | null }[];
    for (const row of cache) {
      const agg = map.get(row.id);
      if (agg) agg.photo = row.photo;
    }
  }

  for (const [id, agg] of map) {
    const t = genderTally.get(id);
    if (t) agg.gender = t.women > t.men ? "women" : "men";
  }

  return [...map.values()];
}

export function getRefereeAggregates(): RefereeAggregate[] {
  const rows = db
    .prepare(
      `SELECT referee_name, home_team, away_team, watch_intervals, date
       FROM matches
       WHERE referee_name IS NOT NULL AND TRIM(referee_name) <> ''`
    )
    .all() as Array<{
      referee_name: string;
      home_team: string;
      away_team: string;
      watch_intervals: string | null;
      date: string;
    }>;

  const map = new Map<string, RefereeAggregate>();
  const genderTally = new Map<string, { men: number; women: number }>();
  for (const r of rows) {
    const intervals: number[][] = (() => {
      try {
        return JSON.parse(r.watch_intervals || "[[0,90]]");
      } catch {
        return [[0, 90]];
      }
    })();
    const minutes = intervals.reduce((s, [a, b]) => s + (b - a), 0);
    const name = r.referee_name.trim();
    const g = matchGender(r.home_team, r.away_team);
    let agg = map.get(name);
    if (!agg) {
      agg = { name, matches: 0, minutes: 0, firstMatch: null, lastMatch: null, gender: "men" };
      map.set(name, agg);
    }
    agg.matches += 1;
    agg.minutes += minutes;
    if (!agg.firstMatch || r.date < agg.firstMatch) agg.firstMatch = r.date;
    if (!agg.lastMatch || r.date > agg.lastMatch) agg.lastMatch = r.date;
    const t = genderTally.get(name) ?? { men: 0, women: 0 };
    t[g] += minutes;
    genderTally.set(name, t);
  }
  for (const [name, agg] of map) {
    const t = genderTally.get(name);
    if (t) agg.gender = t.women > t.men ? "women" : "men";
  }
  return [...map.values()];
}

export function getMatchesByCoachId(coachId: number): Match[] {
  return db
    .prepare(
      `SELECT * FROM matches
       WHERE home_coach_id = ? OR away_coach_id = ?
       ORDER BY date DESC, created_at DESC`
    )
    .all(coachId, coachId) as Match[];
}

export function getMatchesByRefereeName(name: string): Match[] {
  return db
    .prepare(
      `SELECT * FROM matches
       WHERE referee_name = ?
       ORDER BY date DESC, created_at DESC`
    )
    .all(name) as Match[];
}

export function getStadiumAggregates(): StadiumAggregate[] {
  const rows = db
    .prepare(
      `SELECT venue_id, venue, venue_city, home_team, away_team,
              watch_intervals, watched_in_person, date
       FROM matches WHERE venue_id IS NOT NULL`
    )
    .all() as Array<{
      venue_id: number;
      venue: string | null;
      venue_city: string | null;
      home_team: string;
      away_team: string;
      watch_intervals: string | null;
      watched_in_person: number;
      date: string;
    }>;

  const map = new Map<number, StadiumAggregate>();
  // Per-venue gender tally so we can pick the dominant side at the end.
  const genderTally = new Map<number, { men: number; women: number }>();
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
    const g = matchGender(r.home_team, r.away_team);
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
        gender: "men",
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
    const t = genderTally.get(r.venue_id) ?? { men: 0, women: 0 };
    t[g] += mins;
    genderTally.set(r.venue_id, t);
  }
  for (const [id, agg] of map) {
    const t = genderTally.get(id);
    if (t) agg.gender = t.women > t.men ? "women" : "men";
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
    refereeName?: string | null;
    homeCoachId?: number | null;
    homeCoachName?: string | null;
    homeCoachPhoto?: string | null;
    awayCoachId?: number | null;
    awayCoachName?: string | null;
    awayCoachPhoto?: string | null;
    venueId?: number | null;
    venueName?: string | null;
    venueCity?: string | null;
    hadExtraTime?: boolean | null;
    hadPenalties?: boolean | null;
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
    // Detect API-Football home/away inversion. The /fixtures listing and the post-match
    // /fixtures/lineups + /fixtures?id=X endpoints occasionally disagree on which team is
    // designated "home" — typically for neutral-venue games (the 2025 UEFA Nations League
    // final at Allianz Arena flipped Portugal↔Spain). The match row was created under the
    // original designation and player-attribution code keys off `lineup.team` →
    // `match.{home_team, away_team}`, so an unflipped save mis-attributes Bruno Fernandes
    // (Portugal) to Spain. Re-tag the incoming detail rows to align with the existing match
    // row. Goals/cards/subs use the team's NAME (not "home"/"away") so they don't need
    // re-tagging.
    let lineupsToInsert = lineups;
    let metaToUse = meta;
    if (meta?.homeTeamId != null && meta?.awayTeamId != null) {
      const existingRow = db
        .prepare("SELECT home_team_id, away_team_id FROM matches WHERE id = ?")
        .get(matchId) as { home_team_id: number | null; away_team_id: number | null } | undefined;
      const swapped =
        existingRow?.home_team_id != null &&
        existingRow?.away_team_id != null &&
        meta.homeTeamId === existingRow.away_team_id &&
        meta.awayTeamId === existingRow.home_team_id;
      if (swapped) {
        const flip = (t: string) => (t === "home" ? "away" : "home");
        lineupsToInsert = lineups.map((l) => ({ ...l, team: flip(l.team) }));
        metaToUse = {
          ...meta,
          homeFormation: meta.awayFormation ?? null,
          awayFormation: meta.homeFormation ?? null,
          homeCoachId: meta.awayCoachId ?? null,
          homeCoachName: meta.awayCoachName ?? null,
          homeCoachPhoto: meta.awayCoachPhoto ?? null,
          awayCoachId: meta.homeCoachId ?? null,
          awayCoachName: meta.homeCoachName ?? null,
          awayCoachPhoto: meta.homeCoachPhoto ?? null,
          // Keep the match row stable — don't overwrite home_team_id / away_team_id.
          homeTeamId: existingRow!.home_team_id,
          awayTeamId: existingRow!.away_team_id,
        };
      }
    }

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
    for (const l of lineupsToInsert) {
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

    // Repair pass: API-Football's events endpoint occasionally returns a `team.name` on
    // substitution events that doesn't match the player's actual team (e.g. the 2025 UEFA
    // Nations League final tagged every Portugal sub as 'Spain'). Cross-check each sub/card
    // against the just-inserted lineup rows by player id and fix the team name if it's wrong.
    // Goals are intentionally not rebuilt: own goals are legitimately credited to the team
    // OPPOSITE the kicker, so a scorer_id → team rebuild would corrupt them. See v12
    // migration for the equivalent retroactive repair.
    db.prepare(
      `UPDATE match_substitutions
       SET team = (
         SELECT CASE ml.team WHEN 'home' THEN m.home_team ELSE m.away_team END
         FROM match_lineups ml
         JOIN matches m ON m.id = ml.match_id
         WHERE ml.match_id = match_substitutions.match_id
           AND ml.player_id IS NOT NULL
           AND ml.player_id = COALESCE(match_substitutions.player_out_id, match_substitutions.player_in_id)
         LIMIT 1
       )
       WHERE match_substitutions.match_id = ?
         AND EXISTS (
           SELECT 1 FROM match_lineups ml
           WHERE ml.match_id = match_substitutions.match_id
             AND ml.player_id IS NOT NULL
             AND ml.player_id = COALESCE(match_substitutions.player_out_id, match_substitutions.player_in_id)
         )`
    ).run(matchId);
    db.prepare(
      `UPDATE match_cards
       SET team = (
         SELECT CASE ml.team WHEN 'home' THEN m.home_team ELSE m.away_team END
         FROM match_lineups ml
         JOIN matches m ON m.id = ml.match_id
         WHERE ml.match_id = match_cards.match_id
           AND ml.player_id IS NOT NULL
           AND ml.player_id = match_cards.player_id
         LIMIT 1
       )
       WHERE match_cards.match_id = ?
         AND match_cards.player_id IS NOT NULL
         AND EXISTS (
           SELECT 1 FROM match_lineups ml
           WHERE ml.match_id = match_cards.match_id
             AND ml.player_id IS NOT NULL
             AND ml.player_id = match_cards.player_id
         )`
    ).run(matchId);

    // Completeness: both teams have at least one starter AND the saved goal-event count meets
    // or exceeds the final score. Formations and substitution counts are NOT checked because
    // the API legitimately returns null formations and variable sub counts for valid matches.
    // If incomplete, the row is still saved (so partial data shows in stats and on the detail
    // page) but `details_complete=0` keeps it on the rescue loop until lineups/events catch up.
    const scoreRow = db
      .prepare("SELECT home_score, away_score FROM matches WHERE id = ?")
      .get(matchId) as { home_score: number; away_score: number } | undefined;
    const homeStarters = lineupsToInsert.filter((l) => l.team === "home" && l.is_starter === 1).length;
    const awayStarters = lineupsToInsert.filter((l) => l.team === "away" && l.is_starter === 1).length;
    const totalScore = (scoreRow?.home_score ?? 0) + (scoreRow?.away_score ?? 0);
    const complete = homeStarters > 0 && awayStarters > 0 && goals.length >= totalScore ? 1 : 0;

    if (metaToUse) {
      db.prepare(
        `UPDATE matches SET
          details_fetched = 1,
          details_complete = ?,
          home_formation = ?,
          away_formation = ?,
          home_team_id = COALESCE(?, home_team_id),
          away_team_id = COALESCE(?, away_team_id),
          referee_name = COALESCE(?, referee_name),
          home_coach_id = COALESCE(?, home_coach_id),
          home_coach_name = COALESCE(?, home_coach_name),
          away_coach_id = COALESCE(?, away_coach_id),
          away_coach_name = COALESCE(?, away_coach_name),
          venue_id = COALESCE(?, venue_id),
          venue = COALESCE(?, venue),
          venue_city = COALESCE(?, venue_city),
          had_extra_time = COALESCE(?, had_extra_time),
          had_penalties = COALESCE(?, had_penalties)
        WHERE id = ?`
      ).run(
        complete,
        metaToUse.homeFormation ?? null,
        metaToUse.awayFormation ?? null,
        metaToUse.homeTeamId ?? null,
        metaToUse.awayTeamId ?? null,
        metaToUse.refereeName ?? null,
        metaToUse.homeCoachId ?? null,
        metaToUse.homeCoachName ?? null,
        metaToUse.awayCoachId ?? null,
        metaToUse.awayCoachName ?? null,
        metaToUse.venueId ?? null,
        metaToUse.venueName ?? null,
        metaToUse.venueCity ?? null,
        metaToUse.hadExtraTime == null ? null : metaToUse.hadExtraTime ? 1 : 0,
        metaToUse.hadPenalties == null ? null : metaToUse.hadPenalties ? 1 : 0,
        matchId
      );

      // Mirror coach identity into the cache so search and drill-down pages see the coach
      // even when the only signal we have is a fixture lineup (no separate /coachs fetch).
      const upsertCoachStmt = db.prepare(
        `INSERT INTO coaches (id, name, photo, fetched_at)
         VALUES (?, ?, ?, datetime('now'))
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           photo = COALESCE(excluded.photo, coaches.photo)`
      );
      if (metaToUse.homeCoachId != null && metaToUse.homeCoachName) {
        upsertCoachStmt.run(metaToUse.homeCoachId, metaToUse.homeCoachName, metaToUse.homeCoachPhoto ?? null);
      }
      if (metaToUse.awayCoachId != null && metaToUse.awayCoachName) {
        upsertCoachStmt.run(metaToUse.awayCoachId, metaToUse.awayCoachName, metaToUse.awayCoachPhoto ?? null);
      }
    } else {
      db.prepare("UPDATE matches SET details_fetched = 1, details_complete = ? WHERE id = ?").run(complete, matchId);
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
  // Includes both never-fetched rows AND rows that were fetched with incomplete payloads
  // (lineups missing, goals missing) — `details_complete=0` covers both cases.
  const rows = db
    .prepare(
      `SELECT id FROM matches
       WHERE (details_fetched = 0 OR details_complete = 0)
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
  current_team_id: number | null;
  current_team_name: string | null;
  current_team_logo: string | null;
  current_team_fetched_at: string | null;
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

// Writes the season-endpoint team fallback. Always stamps current_team_fetched_at so we can
// distinguish "never tried" (NULL) from "tried, API had no team" (stamped, team_id NULL) — the
// same pattern we use for player_transfer_fetches. Requires the player row to exist; callers
// upsert via upsertPlayer first when needed.
export function upsertPlayerCurrentTeam(
  playerId: number,
  team: { id: number; name: string; logo: string | null } | null
): void {
  db.prepare(
    `UPDATE players
     SET current_team_id = ?, current_team_name = ?, current_team_logo = ?,
         current_team_fetched_at = datetime('now')
     WHERE id = ?`
  ).run(team?.id ?? null, team?.name ?? null, team?.logo ?? null, playerId);
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

export interface CoachRecord {
  id: number;
  name: string;
  photo: string | null;
  nationality: string | null;
  country_code: string | null;
  fetched_at: string;
}

export function getCoach(id: number): CoachRecord | undefined {
  return db.prepare("SELECT * FROM coaches WHERE id = ?").get(id) as CoachRecord | undefined;
}

export function getCoaches(ids: number[]): Map<number, CoachRecord> {
  const map = new Map<number, CoachRecord>();
  if (ids.length === 0) return map;
  const placeholders = ids.map(() => "?").join(",");
  const rows = db
    .prepare(`SELECT * FROM coaches WHERE id IN (${placeholders})`)
    .all(...ids) as CoachRecord[];
  for (const row of rows) map.set(row.id, row);
  return map;
}

// Upsert that preserves nationality/country_code/photo when the new payload doesn't include
// them — the lineup-derived path only knows id+name+photo, while a /coachs?id=X enrichment
// fills in nationality. Without COALESCE on the conflict-update, an enrichment write would
// be wiped out by the next match-hydration upsert.
export function upsertCoach(record: {
  id: number;
  name: string;
  photo: string | null;
  nationality: string | null;
  countryCode: string | null;
}): void {
  db.prepare(
    `INSERT INTO coaches (id, name, photo, nationality, country_code, fetched_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       photo = COALESCE(excluded.photo, coaches.photo),
       nationality = COALESCE(excluded.nationality, coaches.nationality),
       country_code = COALESCE(excluded.country_code, coaches.country_code),
       fetched_at = excluded.fetched_at`
  ).run(record.id, record.name, record.photo, record.nationality, record.countryCode);
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

// Players whose transfers were last fetched more than `maxAgeDays` ago, capped at `limit`.
// Used to refresh stale transfer histories — once a player has any rows we never naturally retry,
// so a TTL-based refetch keeps Ronaldo/Haaland-style "moved clubs since last fetch" cases current.
export function getStaleTransferPlayerIds(maxAgeDays: number, limit: number): number[] {
  const rows = db
    .prepare(
      `SELECT player_id FROM player_transfer_fetches
       WHERE fetched_at < datetime('now', ?)
       ORDER BY fetched_at ASC
       LIMIT ?`
    )
    .all(`-${maxAgeDays} days`, limit) as { player_id: number }[];
  return rows.map((r) => r.player_id);
}

export interface PlayerSeasonRecord {
  player_id: number;
  season: number;
  team_id: number;
  team_name: string | null;
  team_logo: string | null;
  fetched_at: string;
}

export function getPlayerSeasons(playerId: number): PlayerSeasonRecord[] {
  return db
    .prepare(
      "SELECT * FROM player_seasons WHERE player_id = ? ORDER BY season DESC, team_id ASC"
    )
    .all(playerId) as PlayerSeasonRecord[];
}

export function replacePlayerSeasons(
  playerId: number,
  rows: Array<{
    season: number;
    teamId: number;
    teamName: string | null;
    teamLogo: string | null;
  }>
): void {
  const insert = db.prepare(
    `INSERT OR REPLACE INTO player_seasons
       (player_id, season, team_id, team_name, team_logo, fetched_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))`
  );
  const tx = db.transaction(() => {
    db.prepare("DELETE FROM player_seasons WHERE player_id = ?").run(playerId);
    for (const r of rows) {
      insert.run(playerId, r.season, r.teamId, r.teamName, r.teamLogo);
    }
  });
  tx();
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
