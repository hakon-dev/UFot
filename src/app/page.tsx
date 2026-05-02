import { getAllMatches, upsertCompetition, setMatchCompetitionId } from "@/lib/db";
import { enrichCompetitionRecordsWithDetails } from "@/lib/competition-stats";
import { searchLeaguesApi } from "@/lib/football-api";
import { countryNameToCode } from "@/lib/country-codes";
import HomeMatchFeed from "@/components/HomeMatchFeed";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function Home() {
  let matches = getAllMatches();

  // Backfill competition logos for matches whose competition row isn't in the local cache yet.
  // Without this only competitions warmed by /stats or search render a logo on the feed card.
  const missingCompIds = new Set<number>();
  for (const m of matches) {
    if (m.competition_id != null && !m.competition_logo) missingCompIds.add(m.competition_id);
  }
  if (missingCompIds.size > 0) {
    await enrichCompetitionRecordsWithDetails(
      Array.from(missingCompIds).map((id) => ({
        competitionId: id,
        logo: null,
        country: null,
        countryCode: null,
      }))
    );
    matches = getAllMatches();
  }

  // Edge case: matches whose competition_id is still NULL because the v13 migration didn't find
  // a name-match in the competitions cache (e.g. "La Liga" before the user ever searched it).
  // Resolve via /leagues?search=NAME, upsert, and assign the id back to the matches.
  const unmatchedNames = new Set<string>();
  for (const m of matches) {
    if (m.competition_id == null && m.competition) unmatchedNames.add(m.competition);
  }
  if (unmatchedNames.size > 0) {
    let didUpdate = false;
    await Promise.all(
      Array.from(unmatchedNames).slice(0, 10).map(async (name) => {
        try {
          const hits = await searchLeaguesApi(name);
          const exact = hits.find((h) => h.name.toLowerCase() === name.toLowerCase()) ?? hits[0];
          if (!exact) return;
          upsertCompetition({
            id: exact.id,
            name: exact.name,
            country: exact.country,
            countryCode: exact.country ? countryNameToCode(exact.country) : null,
            logo: exact.logo,
          });
          setMatchCompetitionId(name, exact.id);
          didUpdate = true;
        } catch {
          // best-effort
        }
      })
    );
    if (didUpdate) matches = getAllMatches();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Match Feed</h1>
        <div className="flex items-center gap-3">
          {matches.length > 10 && (
            <Link
              href="/matches"
              className="text-sm text-muted hover:text-accent transition-colors inline-flex items-center gap-1"
            >
              See all
              <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M7.293 15.707a1 1 0 010-1.414L11.586 10 7.293 5.707a1 1 0 011.414-1.414l5 5a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            </Link>
          )}
          <Link
            href="/add"
            className="bg-accent hover:bg-accent-dim text-black font-medium px-4 py-2 rounded-lg transition-colors"
          >
            + Add Match
          </Link>
        </div>
      </div>

      {matches.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-muted text-lg">No matches watched yet.</p>
          <Link href="/add" className="text-accent hover:text-accent-dim mt-2 inline-block">
            Add your first match
          </Link>
        </div>
      ) : (
        <HomeMatchFeed matches={matches} pageSize={10} />
      )}
    </div>
  );
}
