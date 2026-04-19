@AGENTS.md

# UFot - Football Match Tracker

## Project Overview
A personal web app to log football matches watched, browse them in a feed, and view statistics. Designed for scalability — future plans include multi-user support with accounts.

## Tech Stack
- **Framework**: Next.js 16 (App Router, TypeScript, Turbopack)
- **Database**: SQLite via `better-sqlite3` (direct, no ORM)
- **Styling**: Tailwind CSS v4
- **Node.js**: v24 (installed at `/c/Program Files/nodejs`)

## Project Structure
```
src/
├── app/
│   ├── layout.tsx         # Root layout with Navbar
│   ├── page.tsx           # Home — match feed (server component)
│   ├── globals.css        # Tailwind + dark theme (accent #c9ff00)
│   ├── add/page.tsx       # Add match — browse-first with MatchBrowser + manual fallback
│   ├── fixtures/[externalId]/page.tsx  # Confirm-before-add preview (reads sessionStorage summary, falls back to summary API)
│   ├── matches/[id]/
│   │   ├── page.tsx       # Match detail page (server component)
│   │   └── MatchDetailClient.tsx  # Client-side details: goals, pitch lineup, two-col subs, benches, interval editor
│   ├── teams/[teamId]/
│   │   └── page.tsx       # Team detail page — Most Watched Players card + watched matches with W/D/L and minutes
│   ├── players/[playerId]/
│   │   ├── page.tsx       # Player detail page — header chips (club/nationality/position/shirt #), totals, appearances, club history
│   │   └── PlayerPhoto.tsx  # Client-side photo with initials fallback
│   ├── stats/
│   │   ├── page.tsx       # Statistics dashboard: Most Watched Competitions + Most Watched Teams + Most Watched Players
│   │   ├── PlayerStatsTable.tsx      # Client component — sortable columns + name/club/nationality filter, photo + /players/[id] links
│   │   ├── CompetitionStatsTable.tsx # Client component — Competition / Matches / Minutes, sortable
│   │   └── TeamStatsTable.tsx        # Client component — Team / Country / Matches / Minutes / GF / GA, sortable + filter
│   └── api/
│       ├── matches/
│       │   ├── route.ts   # GET (list) and POST (create, accepts externalMatchId + externalSource + watchIntervals)
│       │   └── [id]/
│       │       ├── route.ts      # DELETE
│       │       ├── details/route.ts   # GET — lazy-fetch match details from api-football
│       │       └── intervals/route.ts # PUT — update watch intervals
│       └── football/
│           ├── route.ts   # Proxy to api-sports.io (API-Football) fixtures-by-date
│           └── fixtures/[id]/route.ts  # GET — summary for a single fixture + existingMatchId if already added
├── components/
│   ├── Navbar.tsx         # Navigation (client component)
│   ├── MatchCard.tsx      # Match card — clickable (links to /matches/[id]), shows minutes watched
│   ├── MatchBrowser.tsx   # Browse matches by date (prev/next arrows + calendar secondary); clicking a fixture navigates to the /fixtures/[id] confirm page — never auto-writes
│   ├── MatchForm.tsx      # Collapsible manual add-match form with interval editor
│   ├── PitchLineup.tsx    # Horizontal pitch (home left, away right); takes `getAnnotations(player, side)` callback for per-dot goals/assists/cards/sub-off/flag
│   └── WatchIntervalEditor.tsx  # Reusable watch interval editor (timeline + interval rows)
└── lib/
    ├── db.ts              # better-sqlite3 database layer (matches + goals/subs/lineups/cards + players + teams + player_transfers tables)
    ├── football-api.ts    # API-Football (api-sports.io v3) client (fixtures + events + lineups + cards + team profile w/ national flag + player transfers)
    ├── player-stats.ts    # Player watch statistics + getPlayerProfile(playerId) + getPlayerHeader + getPlayerTransferHistory + enrichPlayerStatsWithNationality; computePlayerStats accepts { onlyTeamId } to narrow to one team's side
    ├── team-stats.ts      # Team aggregation: getTeamProfile(teamId), getTeamPlayers(teamId), enrichTeamRecordsWithCountry (propagates `national`)
    ├── country-codes.ts   # Country-name → ISO2 map + flagcdn.com flag URL helper
    └── competition-order.ts  # Competition priority list for display sorting
data/
    └── ufot.db            # SQLite database (gitignored)
```

## Key Decisions
- **No Prisma**: Prisma 7 driver adapter system had compatibility issues on Windows ARM64. Using `better-sqlite3` directly instead.
- **No Google Fonts**: Turbopack had fetch issues with Google Fonts. Using system fonts.
- **`serverExternalPackages`**: `better-sqlite3` is listed in `next.config.ts` to handle native module loading.
- **`export const dynamic = "force-dynamic"`** on pages that read from DB to prevent caching stale data.
- Database auto-creates tables on first import of `db.ts`. Migrations (e.g. adding columns) use `PRAGMA table_info` checks.
- **Design system**: Dark theme with `#c9ff00` (electric lime) accent. Custom CSS variables defined in `globals.css` and registered in Tailwind's `@theme` block (`accent`, `card`, `surface`, `muted`, etc.).
- **External API**: **API-Football v3** (api-sports.io). Auth: `x-apisports-key` header, env var `API_FOOTBALL_KEY`. Free tier = 100 req/day, all endpoints. Covers ~1,200 leagues including Eliteserien.
- **Team crests**: Stored as URLs (`home_crest`, `away_crest` columns). Displayed via `<img>` tags with a placeholder shield SVG for manually-entered matches. Remote images allowed from `crests.football-data.org` (legacy rows) and `media.api-sports.io` (new) in `next.config.ts`.
- **Timezone-aware dates**: The football API proxy accepts a `timeZone` param from the client (via `Intl.DateTimeFormat`) and forwards it to `/fixtures?date=...&timezone=...`. API-Football returns fixtures already bucketed in the requested timezone, so no ±1-day widening is needed.
- **Add match flow**: Browse-first — `/add` auto-loads today's finished matches grouped by competition (sorted by popularity via `competition-order.ts`, which keys on API-Football numeric league IDs). Date is driven by prev/next-day arrows with a calendar picker as secondary; a "Today" shortcut appears once the user navigates away. Clicking a fixture **does NOT write to the DB** — it navigates to `/fixtures/[externalId]` (with the summary stashed in `sessionStorage` under `fixture:<id>` for instant render, falling back to `GET /api/football/fixtures/[id]` on deep-link/refresh). That preview page shows a prominent "Did you watch this?" card with the `WatchIntervalEditor`; only on **Mark as watched** is the row POSTed to `/api/matches` and the user redirected to `/matches/[id]`. Cancel returns to `/add`. If a fixture is already in the DB, `MatchBrowser` links straight to `/matches/[id]` instead. Collapsible manual form remains as fallback for matches not in the API.
- **Watch intervals**: Stored as JSON `[[start, end], ...]` in `watch_intervals` column (default `[[0,90]]`). Editable at add-time and from the match detail page. Stats page shows **Total Minutes** and **Matches Watched** — the old "Equivalent Matches" (minutes / 90) metric was removed everywhere in favor of plain Minutes + Matches.
- **Match details (eager + rescue)**: `external_match_id` + `external_source` stored on add via browse. Hydration (goals with `scorer_id`/`assist_id`, subs with in/out IDs, lineups with per-player IDs and grid positions, formations, team IDs, and yellow/red cards — via `/fixtures/events` + `/fixtures/lineups` + `/fixtures?id=`) happens at **three** moments, all sharing `hydrateMatchDetails(matchId)` in `src/lib/match-hydration.ts`: (1) **POST-time eager fetch** in `/api/matches` right after insert — this was added because relying on the match-detail page's `useEffect` to trigger the fetch left rows stuck at `details_fetched=0` whenever the user bailed before the page loaded, and stats/player aggregation skips `details_fetched=0` rows so matches were invisible; (2) **Lazy on match-detail view** via `/api/matches/[id]/details` for rows that slipped through; (3) **Stats-page rescue** via `hydratePendingMatches(5)` — backfills up to 5 per load (= 15 requests) so transient POST-time failures self-heal. The helper is best-effort: on failure it leaves `details_fetched=0` so the next caller retries. `saveMatchDetails` is **idempotent** — it DELETEs detail rows for the match before inserting, so racing hydration paths (POST + rescue) can't produce duplicates. Cached in `match_goals`, `match_substitutions`, `match_lineups`, `match_cards` tables plus `matches.home_formation` / `away_formation` / `home_team_id` / `away_team_id`. Manual entries and legacy football-data.org rows show "not available". **Schema migrations**: use SQLite `user_version` bumps (currently at v2: v1=scorer/assist ids, v2=match_cards table). A previous `every-import` schema-drift block that wiped details when `home_formation IS NULL` or any sub had `player_in_id IS NULL` was **removed** — those are legitimate API nulls (API doesn't always know formation or substitute IDs), not drift signals. The block fired on every db.ts re-import and created an infinite re-fetch loop that kept specific matches (e.g. Norway vs Switzerland, Everton vs Man United) permanently invisible to stats. Use `user_version` bumps for one-shot migrations when the schema grows.
- **Pitch lineup visualization**: `<PitchLineup>` renders a horizontal pitch (home left, away right, mirrored) with aspect 3/2 and `maxHeight: 70vh` so it fits on screen without scrolling. Players placed by API-Football `grid` (`"row:col"`, row 1 = GK, higher rows toward midfield) with formation-string fallback (e.g. `"4-2-3-1"` → rows of 4, 2, 3, 1). Rows span nearly the full half (GK ~5% from endline, deepest row ~95% — so starters actually fill the pitch instead of clustering near the endline). **Away-half mirror**: within a row, the col→top mapping is reversed for `side === "away"` so that API col 1 (the team's own left, attacking their own goal) lands at the bottom of the screen when the away team attacks leftward. Without this flip both teams' LBs ended up on the screen top. Each starter shows a photo from `https://media.api-sports.io/football/players/{playerId}.png` (no API call — direct CDN), with initials fallback on `onError`. Shirt-number badge on photo. Clicking a player goes to `/players/{id}`; clicking a team header goes to `/teams/{id}`. **Per-player annotations** (via a `getAnnotations(player, side)` callback from `MatchDetailClient`): club crest **or** nationality flag under the photo (club wins when set — see national-team handling below), yellow/red card badge top-right, sub-off arrow top-left (with red-card/subbed-off → photo dimmed to 60%), and a small event line below the name showing a ball SVG for goals, boot SVG for assists (`BallIcon` / `BootIcon` — inline so they scale with dot size), plus `↓75'` for sub-off. **Badges live on a relative outer wrapper, not inside the `rounded-full overflow-hidden` photo circle** — otherwise the shirt number / card / sub-off badges get clipped by the circle and disappear. Goal/assist attribution matches by `player_id` first, falls back to name.
- **National-team pitches → club on dot**: The `teams` cache carries a `national` flag (API-Football `/teams?id=X` → `team.national`). The match-details API route detects `homeIsNational` / `awayIsNational`, and for starters on any national-team side it fetches `/transfers?player=X` (bounded to 25 new fetches per match view) and writes them to the `player_transfers` table. It then picks each player's most-recent non-national `team.in` row and returns a `playerClubs` map. `MatchDetailClient.getAnnotations` swaps nationality for club (logo + name + `/teams/{clubId}` link) on national-team sides; club-vs-club matches are unchanged. A dedicated `player_transfer_fetches` table records which players have been tried so empty-result fetches aren't retried forever.
- **Team & player profile pages**: `/teams/[teamId]` and `/players/[playerId]` aggregate watched matches. Team page shows W/D/L, Matches, GF/GA, goal diff, minutes, per-match result letters (W/D/L), plus a **Most Watched Players** card scoped to players from this team's side of each match (via `getTeamPlayers(teamId)` → `computePlayerStats({ onlyTeamId })`, reusing the same sortable/filterable `PlayerStatsTable`). Player page shows a header with **Club / Nationality / Position / Shirt #** chips (position + shirt come from `/players/profiles` — the `players` cache table stores them), a stats grid of minutes/matches/goals/assists/yellows/reds, an Appearances list, and a **Club history** card rendered from `player_transfers` (fetched lazily via `getPlayerTransferHistory`).
- **Player identity unification**: Player stats and the player-profile page both first build a global `name → id` map across every match's lineups, goal/assist ids, sub in/out ids, and card player ids. `computePlayerStats.ensure(playerId, name)` resolves a name-only record to its canonical id when available, and if we find an existing `name:{name}` orphan when an id is now known it re-keys it to `id:{resolvedId}` (merging the two half-records). `getPlayerProfile(playerId)` accepts a lineup row as this player's appearance when either `lineup.player_id === playerId` *or* `lineup.player_id == null && knownNames.has(lineup.player_name)`. When a profile is requested for someone with no appearances, we no longer `notFound()` — the page falls back to the `players` cache header plus a "No watched appearances yet" line. Fixes both the "one match instead of two" undercount and the clickthrough 404s.
- **Substitutions + cards split**: On match detail, subs and cards each render in two columns (home left, away right) with a linked team header for each, so team ownership is immediately visible.
- **API-Football quirks**: For `type="subst"` events, `player` = player going OFF, `assist` = player coming ON. For `type="Goal"` events, `detail="Missed Penalty"` must be filtered out (not a scored goal). `detail` strings ("Normal Goal"/"Own Goal"/"Penalty") are mapped to UFot's stored types ("REGULAR"/"OWN_GOAL"/"PENALTY"). For `type="Card"` events, `detail` is matched case-insensitively: "Yellow Card" → `YELLOW`, "Second Yellow card" → `YELLOWRED`, "Red Card" → `RED`.
- **Player statistics**: Computes per-player minutes watched using interval overlap between player playing time (start to sub-out) and user's watch intervals. Goals/assists/yellows/reds only counted if the event minute falls within watch intervals. Each stat also carries **club** (team + crest + id from the player's most recent watched match) and **nationality** (name + ISO2 code). `PlayerStatsTable` has sortable Y and R columns. The player profile page (`/players/[playerId]`) shows total yellows/reds alongside minutes/matches/goals/assists, and flags per-appearance cards.
- **Player nationality (lazy-fetch)**: Nationalities are cached in a `players` table (`id, name, nationality, country_code, photo, position, shirt_number, fetched_at`). On each stats-page load, `enrichPlayerStatsWithNationality` fills from cache for all players and fetches up to 20 uncached ones via `/players/profiles?player=X` (1 req per player, bounded to respect 100/day). `position` + `shirt_number` ride along on the same fetch — the player page reads them directly from this cache for the header chips. Country-name → ISO2 lives in `country-codes.ts` (hardcoded common football nations, with UK home-nation codes `gb-eng`/`gb-sct`/`gb-wls`/`gb-nir`). Flag URLs use `flagcdn.com/{code}.svg` (not api-sports flags, which don't support home-nation subdivisions).
- **Team country + national flag (lazy-fetch)**: A `teams` table (`id, name, country, country_code, logo, national`) caches results from `/teams?id=X`. `enrichTeamRecordsWithCountry` (in `team-stats.ts`) fills from cache and fetches up to 20 uncached per stats-page visit; it now also propagates `national`. `isNational` / the national-team pitch path in the match-details API rely on the same table, fetching on demand for the two match teams when absent.
- **Player transfers (lazy-fetch)**: `player_transfers` table stores one row per transfer (`player_id, transfer_date, type, team_in_id/name/logo, team_out_id/name/logo, fetched_at`, unique on `(player_id, transfer_date, team_in_id)`). A sibling `player_transfer_fetches` tracking table records players we've already tried, so empty results don't cause re-fetch storms. `fetchPlayerTransfers(playerId)` calls `/transfers?player={id}` and is invoked from two places: (1) the match-details route for national-team starters, and (2) `getPlayerTransferHistory(playerId)` on the player page for the Club History card. The player page prefers cache and only fetches when `hasFetchedPlayerTransfers` is false.
- **Stats UI**: The `/stats` page has four overview cards (Matches Watched, Total Minutes, Total Goals Seen, Avg Goals/Match), then three sortable tables — **Most Watched Competitions** (Competition / Matches / Minutes), **Most Watched Teams** (Team / Country / Matches / Minutes / GF / GA, with text filter), and **Most Watched Players** (existing `PlayerStatsTable`, with filter on name/club/nationality). All three tables share the same `HeaderButton` + `SortArrow` + `compare` pattern: numeric columns default to `desc`, strings to `asc`, active header shows a `▲/▼` glyph. When the filter is non-empty on Players, the top-20 cap is lifted so hits aren't hidden.

## Environment Notes
- Windows 11 ARM64
- PATH for Node.js in bash: `export PATH="/c/Program Files/nodejs:$PATH"`
- PATH for GitHub CLI in bash: `export PATH="$PATH:/c/Program Files/GitHub CLI"`
- Git user configured locally (hakon-dev / hakonm97@gmail.com)
- GitHub repo: https://github.com/hakon-dev/UFot

## Commands
- `npm run dev` — start dev server (port 3000)
- `npm run build` — production build
