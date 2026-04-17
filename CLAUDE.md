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
│   ├── add/page.tsx       # Add match form
│   ├── stats/page.tsx     # Statistics dashboard with team logos
│   └── api/
│       ├── matches/
│       │   ├── route.ts   # GET (list) and POST (create)
│       │   └── [id]/route.ts  # DELETE
│       └── football/
│           └── route.ts   # Proxy to football-data.org API
├── components/
│   ├── Navbar.tsx         # Navigation (client component)
│   ├── MatchCard.tsx      # Match card with team crests (client component)
│   ├── MatchForm.tsx      # Add match form (client component)
│   └── MatchSearch.tsx    # Football API date search (client component)
└── lib/
    ├── db.ts              # better-sqlite3 database layer
    └── football-api.ts    # football-data.org v4 API client
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

## Environment Notes
- Windows 11 ARM64
- PATH for Node.js in bash: `export PATH="/c/Program Files/nodejs:$PATH"`
- PATH for GitHub CLI in bash: `export PATH="$PATH:/c/Program Files/GitHub CLI"`
- Git user configured locally (hakon-dev / hakonm97@gmail.com)
- GitHub repo: https://github.com/hakon-dev/UFot

## Commands
- `npm run dev` — start dev server (port 3000)
- `npm run build` — production build
