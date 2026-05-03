import { getCompetitions, upsertCompetition } from "./db";
import { countryNameToCode } from "./country-codes";
import { fetchLeagueProfile } from "./football-api";

export interface CompetitionCountryRecord {
  competitionId: number | null;
  logo: string | null;
  country: string | null;
  countryCode: string | null;
}

// API-Football labels every continental/supranational competition as country "World" — which
// is technically true but hides the region. Override known UEFA competitions to "Europe" so
// the stats tables can show a meaningful flag. Applied at read time, not persisted, so adding
// entries later doesn't require a cache wipe.
// Continental / supranational competitions come back from API-Football as country "World".
// All regions use the globe icon in the UI — the EU flag is politically distinct from UEFA
// and flagcdn has no dedicated continent flags, so keeping the icon uniform avoids confusion.
const REGION_OVERRIDES: Record<number, { country: string; countryCode: string | null }> = {
  2: { country: "Europe", countryCode: null },           // UEFA Champions League
  3: { country: "Europe", countryCode: null },           // UEFA Europa League
  4: { country: "Europe", countryCode: null },           // Euro Championship
  5: { country: "Europe", countryCode: null },           // UEFA Nations League
  531: { country: "Europe", countryCode: null },         // UEFA Super Cup
  848: { country: "Europe", countryCode: null },         // UEFA Europa Conference League
  6: { country: "Africa", countryCode: null },           // Africa Cup of Nations
  7: { country: "Asia", countryCode: null },             // AFC Asian Cup
  9: { country: "South America", countryCode: null },    // Copa America
  11: { country: "South America", countryCode: null },   // Copa Sudamericana
  13: { country: "South America", countryCode: null },   // Copa Libertadores
  22: { country: "North America", countryCode: null },   // CONCACAF Gold Cup
};

const REGION_NAMES = new Set([
  "World",
  "Europe",
  "Africa",
  "Asia",
  "South America",
  "North America",
  "Oceania",
]);

export function isRegionName(name: string | null | undefined): boolean {
  return !!name && REGION_NAMES.has(name);
}

export function resolveCompetitionRegion(
  competitionId: number | null,
  fallbackCountry: string | null,
  fallbackCode: string | null
): { country: string | null; countryCode: string | null } {
  if (competitionId != null) {
    const override = REGION_OVERRIDES[competitionId];
    if (override) return override;
  }
  return { country: fallbackCountry, countryCode: fallbackCode };
}

function applyRegionOverride<T extends CompetitionCountryRecord>(r: T): void {
  const { country, countryCode } = resolveCompetitionRegion(
    r.competitionId,
    r.country,
    r.countryCode
  );
  r.country = country;
  r.countryCode = countryCode;
}

export async function enrichCompetitionRecordsWithDetails<T extends CompetitionCountryRecord>(
  records: T[],
  options: { maxFetches?: number } = {}
): Promise<void> {
  const maxFetches = options.maxFetches ?? 20;

  const ids = records.map((r) => r.competitionId).filter((id): id is number => id != null);
  const cached = getCompetitions(ids);

  for (const r of records) {
    if (r.competitionId == null) continue;
    const rec = cached.get(r.competitionId);
    if (rec) {
      r.logo = rec.logo;
      r.country = rec.country;
      r.countryCode = rec.country_code;
    }
    applyRegionOverride(r);
  }

  const toFetch = records
    .filter((r) => r.competitionId != null && !cached.has(r.competitionId))
    .slice(0, maxFetches);

  await Promise.all(
    toFetch.map(async (r) => {
      if (r.competitionId == null) return;
      try {
        const profile = await fetchLeagueProfile(r.competitionId);
        if (!profile) return;
        const code = countryNameToCode(profile.country);
        upsertCompetition({
          id: profile.id,
          name: profile.name,
          country: profile.country,
          countryCode: code,
          logo: profile.logo,
        });
        r.logo = profile.logo;
        r.country = profile.country;
        r.countryCode = code;
        applyRegionOverride(r);
      } catch {
        // Best-effort; missing values fall back to "-" in the UI.
      }
    })
  );
}
