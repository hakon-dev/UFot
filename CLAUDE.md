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
│   │   └── MatchDetailClient.tsx  # Client-side details: goals, subs, lineups, interval editor
│   ├── stats/
│   │   ├── page.tsx       # Statistics dashboard with team logos + player stats
│   │   └── PlayerStatsTable.tsx  # Client component for player stats with show-all toggle
│   └── api/
│       ├── matches/
│       │   ├── route.ts   # GET (list) and POST (create, accepts footballDataId + watchIntervals)
│       │   └── [id]/
│       │       ├── route.ts      # DELETE
│       │       ├── details/route.ts   # GET — lazy-fetch match details from football-data.org
│       │       └── intervals/route.ts # PUT — update watch intervals
│       └── football/
│           └── route.ts   # Proxy to football-data.org API
├── components/
│   ├── Navbar.tsx         # Navigation (client component)
│   ├── MatchCard.tsx      # Match card — clickable (links to /matches/[id]), shows minutes watched
│   ├── MatchBrowser.tsx   # Browse matches by date, click-to-add with inline interval editor
│   ├── MatchForm.tsx      # Collapsible manual add-match form with interval editor
│   └── WatchIntervalEditor.tsx  # Reusable watch interval editor (timeline + interval rows)
└── lib/
    ├── db.ts              # better-sqlite3 database layer (matches + goals/subs/lineups tables)
    ├── football-api.ts    # football-data.org v4 API client (match search + match details)
    ├── player-stats.ts    # Player watch statistics computation (overlap algorithm)
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
- **Team crests**: Stored as URLs (`home_crest`, `away_crest` columns) from football-data.org API. Displayed via `<img>` tags with a placeholder shield SVG for manually-entered matches. Remote images allowed from `crests.football-data.org` in `next.config.ts`.
- **Timezone-aware dates**: The football API proxy accepts a `timeZone` param from the client (via `Intl.DateTimeFormat`). Matches are converted from UTC to local time for correct date grouping. The API query range is widened by ±1 day to catch timezone boundary matches, then filtered.
- **Add match flow**: Browse-first — `/add` auto-loads today's finished matches grouped by competition (sorted by popularity via `competition-order.ts`). Click a match to add it directly. Collapsible manual form as fallback.
- **Watch intervals**: Stored as JSON `[[start, end], ...]` in `watch_intervals` column (default `[[0,90]]`). Editable at add-time and from the match detail page. Stats page computes "equivalent matches" as total minutes / 90.
- **Match details (lazy-fetch)**: `football_data_id` stored on add via browse. Details (goals, subs, lineups) fetched from `/v4/matches/{id}` on first click and cached in `match_goals`, `match_substitutions`, `match_lineups` tables. Manual matches show "not available".
- **Player statistics**: Computes per-player minutes watched using interval overlap between player playing time (start to sub-out) and user's watch intervals. Goals/assists only counted if the minute falls within watch intervals.

## Environment Notes
- Windows 11 ARM64
- PATH for Node.js in bash: `export PATH="/c/Program Files/nodejs:$PATH"`
- PATH for GitHub CLI in bash: `export PATH="$PATH:/c/Program Files/GitHub CLI"`
- Git user configured locally (hakon-dev / hakonm97@gmail.com)
- GitHub repo: https://github.com/hakon-dev/UFot

## Commands
- `npm run dev` — start dev server (port 3000)
- `npm run build` — production build
