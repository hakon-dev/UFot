import { NextRequest, NextResponse } from "next/server";
import {
  searchTeamsCache,
  searchPlayersCache,
  searchCompetitionsCache,
  searchStadiumsCache,
  searchCoachesCache,
  searchRefereesCache,
  upsertTeam,
  upsertCompetition,
  upsertPlayer,
  upsertCoach,
} from "@/lib/db";
import {
  searchTeamsApi,
  searchLeaguesApi,
  searchPlayersApi,
  searchVenuesApi,
  searchCoachesApi,
} from "@/lib/football-api";
import { countryNameToCode, searchCountries } from "@/lib/country-codes";

export interface TeamSearchHit {
  id: number;
  name: string;
  logo: string | null;
  country: string | null;
  countryCode: string | null;
  national: boolean | null;
  source: "cache" | "api";
}

export interface PlayerSearchHit {
  id: number;
  name: string;
  photo: string | null;
  nationality: string | null;
  countryCode: string | null;
  source: "cache" | "api";
}

export interface CompetitionSearchHit {
  id: number;
  name: string;
  logo: string | null;
  country: string | null;
  countryCode: string | null;
  source: "cache" | "api";
}

export interface StadiumSearchHit {
  id: number;
  name: string;
  city: string | null;
  country: string | null;
  source: "cache" | "api";
}

export interface CoachSearchHit {
  id: number;
  name: string;
  photo: string | null;
  nationality: string | null;
  countryCode: string | null;
  source: "cache" | "api";
}

// Referees have no API id — keyed by name. The slug is URL-encoded so it survives Next.js
// dynamic-segment routing without tripping on apostrophes / spaces.
export interface RefereeSearchHit {
  slug: string;
  name: string;
  matches: number;
  source: "cache";
}

// Countries come from the static country-codes map — no API, no cache, just substring match.
export interface CountrySearchHit {
  code: string;
  name: string;
  source: "static";
}

export interface SearchResponse {
  teams: TeamSearchHit[];
  players: PlayerSearchHit[];
  competitions: CompetitionSearchHit[];
  stadiums: StadiumSearchHit[];
  coaches: CoachSearchHit[];
  referees: RefereeSearchHit[];
  countries: CountrySearchHit[];
  liveError: string | null;
}

const PER_GROUP = 6;

function dedupeBy<T>(arr: T[], key: (t: T) => string | number): T[] {
  const seen = new Set<string | number>();
  const out: T[] = [];
  for (const item of arr) {
    const k = key(item);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }
  return out;
}

export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim();
  if (!q) {
    return NextResponse.json<SearchResponse>({
      teams: [], players: [], competitions: [], stadiums: [],
      coaches: [], referees: [], countries: [], liveError: null,
    });
  }

  // Cache results are instant — return them even when the query is too short for the live API
  // (which requires 3+ chars).
  const cacheTeams: TeamSearchHit[] = searchTeamsCache(q, PER_GROUP).map((t) => ({
    id: t.id,
    name: t.name,
    logo: t.logo,
    country: t.country,
    countryCode: t.country_code,
    national: t.national == null ? null : t.national === 1,
    source: "cache",
  }));
  const cachePlayers: PlayerSearchHit[] = searchPlayersCache(q, PER_GROUP).map((p) => ({
    id: p.id,
    name: p.name,
    photo: p.photo,
    nationality: p.nationality,
    countryCode: p.country_code,
    source: "cache",
  }));
  const cacheCompetitions: CompetitionSearchHit[] = searchCompetitionsCache(q, PER_GROUP).map((c) => ({
    id: c.id,
    name: c.name,
    logo: c.logo,
    country: c.country,
    countryCode: c.country_code,
    source: "cache",
  }));
  const cacheStadiums: StadiumSearchHit[] = searchStadiumsCache(q, PER_GROUP).map((s) => ({
    id: s.venueId,
    name: s.venueName,
    city: s.venueCity,
    country: null,
    source: "cache",
  }));
  const cacheCoaches: CoachSearchHit[] = searchCoachesCache(q, PER_GROUP).map((c) => ({
    id: c.id,
    name: c.name,
    photo: c.photo,
    nationality: c.nationality,
    countryCode: c.country_code,
    source: "cache",
  }));
  // Referees only ever come from the local cache — no API endpoint exists.
  const cacheReferees: RefereeSearchHit[] = searchRefereesCache(q, PER_GROUP).map((r) => ({
    slug: encodeURIComponent(r.name),
    name: r.name,
    matches: r.matches,
    source: "cache",
  }));
  // Countries are just a substring match against the static country-codes map.
  const countryHits: CountrySearchHit[] = searchCountries(q, PER_GROUP).map((c) => ({
    code: c.code,
    name: c.name,
    source: "static",
  }));

  let liveError: string | null = null;
  let apiTeams: TeamSearchHit[] = [];
  let apiPlayers: PlayerSearchHit[] = [];
  let apiCompetitions: CompetitionSearchHit[] = [];
  let apiStadiums: StadiumSearchHit[] = [];
  let apiCoaches: CoachSearchHit[] = [];

  if (q.length >= 3) {
    // Fan out the four API search calls in parallel. Each costs 1 daily request — at 4 per
    // user-search this is the costliest path in the app, so the client must debounce + only
    // search after the user has stopped typing.
    const [teamsRes, playersRes, leaguesRes, venuesRes, coachesRes] = await Promise.allSettled([
      searchTeamsApi(q),
      searchPlayersApi(q),
      searchLeaguesApi(q),
      searchVenuesApi(q),
      searchCoachesApi(q),
    ]);

    if (teamsRes.status === "fulfilled") {
      apiTeams = teamsRes.value.slice(0, PER_GROUP).map((t) => ({
        id: t.id,
        name: t.name,
        logo: t.logo,
        country: t.country,
        countryCode: t.country ? countryNameToCode(t.country) : null,
        national: t.national,
        source: "api",
      }));
      // Warm the local cache so a repeat search is instant and cheaper next time.
      for (const t of teamsRes.value) {
        upsertTeam({
          id: t.id, name: t.name, country: t.country,
          countryCode: t.country ? countryNameToCode(t.country) : null,
          logo: t.logo, national: t.national,
        });
      }
    } else {
      liveError = String(teamsRes.reason?.message ?? teamsRes.reason);
    }

    if (playersRes.status === "fulfilled") {
      apiPlayers = playersRes.value.slice(0, PER_GROUP).map((p) => ({
        id: p.id,
        name: p.name,
        photo: p.photo,
        nationality: p.nationality,
        countryCode: p.nationality ? countryNameToCode(p.nationality) : null,
        source: "api",
      }));
      for (const p of playersRes.value) {
        upsertPlayer({
          id: p.id, name: p.name, nationality: p.nationality,
          countryCode: p.nationality ? countryNameToCode(p.nationality) : null,
          photo: p.photo, position: null, shirtNumber: null,
        });
      }
    } else if (!liveError) {
      liveError = String(playersRes.reason?.message ?? playersRes.reason);
    }

    if (leaguesRes.status === "fulfilled") {
      apiCompetitions = leaguesRes.value.slice(0, PER_GROUP).map((l) => ({
        id: l.id,
        name: l.name,
        logo: l.logo,
        country: l.country,
        countryCode: l.country ? countryNameToCode(l.country) : null,
        source: "api",
      }));
      for (const l of leaguesRes.value) {
        upsertCompetition({
          id: l.id, name: l.name, country: l.country,
          countryCode: l.country ? countryNameToCode(l.country) : null,
          logo: l.logo,
        });
      }
    } else if (!liveError) {
      liveError = String(leaguesRes.reason?.message ?? leaguesRes.reason);
    }

    if (venuesRes.status === "fulfilled") {
      apiStadiums = venuesRes.value.slice(0, PER_GROUP).map((v) => ({
        id: v.id,
        name: v.name,
        city: v.city,
        country: v.country,
        source: "api",
      }));
    } else if (!liveError) {
      liveError = String(venuesRes.reason?.message ?? venuesRes.reason);
    }

    if (coachesRes.status === "fulfilled") {
      apiCoaches = coachesRes.value.slice(0, PER_GROUP).map((c) => ({
        id: c.id,
        name: c.name,
        photo: c.photo,
        nationality: c.nationality,
        countryCode: c.nationality ? countryNameToCode(c.nationality) : null,
        source: "api",
      }));
      for (const c of coachesRes.value) {
        upsertCoach({
          id: c.id, name: c.name, photo: c.photo,
          nationality: c.nationality,
          countryCode: c.nationality ? countryNameToCode(c.nationality) : null,
        });
      }
    } else if (!liveError) {
      liveError = String(coachesRes.reason?.message ?? coachesRes.reason);
    }
  }

  return NextResponse.json<SearchResponse>({
    teams: dedupeBy([...cacheTeams, ...apiTeams], (t) => t.id).slice(0, PER_GROUP),
    players: dedupeBy([...cachePlayers, ...apiPlayers], (p) => p.id).slice(0, PER_GROUP),
    competitions: dedupeBy([...cacheCompetitions, ...apiCompetitions], (c) => c.id).slice(0, PER_GROUP),
    stadiums: dedupeBy([...cacheStadiums, ...apiStadiums], (s) => s.id).slice(0, PER_GROUP),
    coaches: dedupeBy([...cacheCoaches, ...apiCoaches], (c) => c.id).slice(0, PER_GROUP),
    referees: cacheReferees.slice(0, PER_GROUP),
    countries: countryHits,
    liveError,
  });
}
