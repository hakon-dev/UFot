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
│   ├── matches/[id]/
│   │   ├── page.tsx       # Match detail page (server component)
│   │   └── MatchDetailClient.tsx  # Client-side details: goals, pitch lineup, two-col subs, benches, interval editor
│   ├── teams/[teamId]/
│   │   └── page.tsx       # Team detail page — Most Watched Players card + watched matches with W/D/L and minutes
│   ├── players/[playerId]/
│   │   ├── page.tsx       # Player detail page — photo, totals, per-match appearances
│   │   └── PlayerPhoto.tsx  # Client-side photo with initials fallback
│   ├── stats/
│   │   ├── page.tsx       # Statistics dashboard: Most Watched Teams (with country) + Most Watched Players
│   │   └── PlayerStatsTable.tsx  # Client component — sortable columns + name/club/nationality filter, photo + /players/[id] links
│   └── api/
│       ├── matches/
│       │   ├── route.ts   # GET (list) and POST (create, accepts externalMatchId + externalSource + watchIntervals)
│       │   └── [id]/
│       │       ├── route.ts      # DELETE
│       │       ├── details/route.ts   # GET — lazy-fetch match details from api-football
│       │       └── intervals/route.ts # PUT — update watch intervals
│       └── football/
│           └── route.ts   # Proxy to api-sports.io (API-Football) fixtures-by-date
├── components/
│   ├── Navbar.tsx         # Navigation (client component)
│   ├── MatchCard.tsx      # Match card — clickable (links to /matches/[id]), shows minutes watched
│   ├── MatchBrowser.tsx   # Browse matches by date, click-to-add with inline interval editor
│   ├── MatchForm.tsx      # Collapsible manual add-match form with interval editor
│   ├── PitchLineup.tsx    # Horizontal pitch (home left, away right); takes `getAnnotations(player, side)` callback for per-dot goals/assists/cards/sub-off/flag
│   └── WatchIntervalEditor.tsx  # Reusable watch interval editor (timeline + interval rows)
└── lib/
    ├── db.ts              # better-sqlite3 database layer (matches + goals/subs/lineups/cards tables)
    ├── football-api.ts    # API-Football (api-sports.io v3) client (fixtures search + events + lineups + cards)
    ├── player-stats.ts    # Player watch statistics + getPlayerProfile(playerId) + enrichPlayerStatsWithNationality + getPlayerNationalities(ids); computePlayerStats accepts { onlyTeamId } to narrow to one team's side
    ├── team-stats.ts      # Team aggregation: getTeamProfile(teamId), getTeamPlayers(teamId), enrichTeamRecordsWithCountry
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
- **Add match flow**: Browse-first — `/add` auto-loads today's finished matches grouped by competition (sorted by popularity via `competition-order.ts`, which keys on API-Football numeric league IDs). Click a match to add it directly. Collapsible manual form as fallback.
- **Watch intervals**: Stored as JSON `[[start, end], ...]` in `watch_intervals` column (default `[[0,90]]`). Editable at add-time and from the match detail page. Stats page computes "equivalent matches" as total minutes / 90.
- **Match details (lazy-fetch)**: `external_match_id` + `external_source` stored on add via browse. When `external_source === "api-football"`, details (goals with `scorer_id`/`assist_id`, subs with in/out IDs, lineups with per-player IDs and grid positions, formations, team IDs, and yellow/red cards) are fetched via `/fixtures/events` + `/fixtures/lineups` + `/fixtures?id=` on first click and cached in `match_goals`, `match_substitutions`, `match_lineups`, `match_cards` tables plus `matches.home_formation` / `away_formation` / `home_team_id` / `away_team_id`. Manual entries and legacy football-data.org rows show "not available". **Schema-drift re-hydrate**: on db.ts import, any api-football match with `details_fetched=1` but `home_formation IS NULL` (or subs without `player_in_id`) has its cached detail rows purged and `details_fetched` reset to 0 — next view triggers a re-fetch. **One-shot re-hydrate via SQLite `user_version`**: bumped to `2` when `match_cards` landed so existing rows re-fetch and pick up the new event type (v1 was the earlier scorer/assist id migration). Bump this any time the details payload grows — the schema-drift block alone would infinite-loop on legit-null rows.
- **Pitch lineup visualization**: `<PitchLineup>` renders a horizontal pitch (home left, away right, mirrored) with aspect 3/2 and `maxHeight: 70vh` so it fits on screen without scrolling. Players placed by API-Football `grid` (`"row:col"`, row 1 = GK, higher rows toward midfield) with formation-string fallback (e.g. `"4-2-3-1"` → rows of 4, 2, 3, 1). Rows span nearly the full half (GK ~5% from endline, deepest row ~95% — so starters actually fill the pitch instead of clustering near the endline). Each starter shows a photo from `https://media.api-sports.io/football/players/{playerId}.png` (no API call — direct CDN), with initials fallback on `onError`. Shirt-number badge on photo. Clicking a player goes to `/players/{id}`; clicking a team header goes to `/teams/{id}`. **Per-player annotations** (via a `getAnnotations(player, side)` callback from `MatchDetailClient`): nationality flag under the photo, yellow/red card badge top-right, sub-off arrow top-left (with red-card/subbed-off → photo dimmed to 60%), and a small event line below the name showing `⚽×N` / `🅰×N` / `↓75'`. Goal/assist attribution matches by `player_id` first, falls back to name.
- **Team & player profile pages**: `/teams/[teamId]` and `/players/[playerId]` aggregate watched matches. Team page shows W/D/L, GF/GA, eq. matches, per-match result letters (W/D/L), plus a **Most Watched Players** card scoped to players from this team's side of each match (via `getTeamPlayers(teamId)` → `computePlayerStats({ onlyTeamId })`, reusing the same sortable/filterable `PlayerStatsTable`). Player page shows minutes/goals/assists totals and per-match appearances. Player identity in stats is keyed by `player_id` when available, falling back to `name:{name}` so legacy name-only entries still aggregate. Goal/assist attribution uses `match_goals.scorer_id` / `assist_id` first (from API-Football event payload), then falls back to a per-match `name → player_id` lineup lookup — this prevents the name-variant duplicates ("M. Ødegaard" in events vs. "Martin Ødegaard" in lineups) that used to produce a second row.
- **Substitutions + cards split**: On match detail, subs and cards each render in two columns (home left, away right) with a linked team header for each, so team ownership is immediately visible.
- **API-Football quirks**: For `type="subst"` events, `player` = player going OFF, `assist` = player coming ON. For `type="Goal"` events, `detail="Missed Penalty"` must be filtered out (not a scored goal). `detail` strings ("Normal Goal"/"Own Goal"/"Penalty") are mapped to UFot's stored types ("REGULAR"/"OWN_GOAL"/"PENALTY"). For `type="Card"` events, `detail` is matched case-insensitively: "Yellow Card" → `YELLOW`, "Second Yellow card" → `YELLOWRED`, "Red Card" → `RED`.
- **Player statistics**: Computes per-player minutes watched using interval overlap between player playing time (start to sub-out) and user's watch intervals. Goals/assists/yellows/reds only counted if the event minute falls within watch intervals. Each stat also carries **club** (team + crest + id from the player's most recent watched match) and **nationality** (name + ISO2 code). `PlayerStatsTable` has sortable Y and R columns. The player profile page (`/players/[playerId]`) shows total yellows/reds alongside minutes/matches/goals/assists, and flags per-appearance cards.
- **Player nationality (lazy-fetch)**: Nationalities are cached in a `players` table (`id, name, nationality, country_code, photo`). On each stats-page load, `enrichPlayerStatsWithNationality` fills from cache for all players and fetches up to 20 uncached ones via `/players/profiles?player=X` (1 req per player, bounded to respect 100/day). Country-name → ISO2 lives in `country-codes.ts` (hardcoded common football nations, with UK home-nation codes `gb-eng`/`gb-sct`/`gb-wls`/`gb-nir`). Flag URLs use `flagcdn.com/{code}.svg` (not api-sports flags, which don't support home-nation subdivisions).
- **Team country (lazy-fetch)**: Same pattern as players, but for teams. A `teams` table (`id, name, country, country_code, logo`) caches results from `/teams?id=X`. `enrichTeamRecordsWithCountry` (in `team-stats.ts`) fills from cache and fetches up to 20 uncached per stats-page visit. Country column on the Most Watched Teams table renders the flag via `flagcdn.com`.
- **Player stats UI**: `PlayerStatsTable` exposes a text filter (matches substring on name/club/nationality, case-insensitive) and click-to-sort on every column. Numeric columns default to `desc`, strings to `asc`; active header shows a `▲/▼` glyph. When the filter is non-empty the top-20 cap is lifted so hits aren't hidden.

## Environment Notes
- Windows 11 ARM64
- PATH for Node.js in bash: `export PATH="/c/Program Files/nodejs:$PATH"`
- PATH for GitHub CLI in bash: `export PATH="$PATH:/c/Program Files/GitHub CLI"`
- Git user configured locally (hakon-dev / hakonm97@gmail.com)
- GitHub repo: https://github.com/hakon-dev/UFot

## Commands
- `npm run dev` — start dev server (port 3000)
- `npm run build` — production build
