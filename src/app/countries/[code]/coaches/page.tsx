import Link from "next/link";
import { notFound } from "next/navigation";
import { getCoachAggregates, getCoaches } from "@/lib/db";
import { codeToCountryName } from "@/lib/country-codes";
import { enrichCoachAggregatesWithNationality } from "@/lib/coach-stats";
import CoachStatsTable, { type CoachStat } from "@/app/coaches/CoachStatsTable";

export const dynamic = "force-dynamic";

export default async function CountryCoachesPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code: rawCode } = await params;
  const code = rawCode.toLowerCase();
  const countryName = codeToCountryName(code);
  if (!countryName) notFound();

  const coachAggregates = getCoachAggregates();
  await enrichCoachAggregatesWithNationality(coachAggregates);
  const coachCache = getCoaches(coachAggregates.map((a) => a.coachId));
  const coachesFromCountry: CoachStat[] = coachAggregates
    .map((a) => {
      const cache = coachCache.get(a.coachId);
      return {
        coachId: a.coachId,
        name: cache?.name ?? a.name,
        photo: a.photo ?? cache?.photo ?? null,
        nationality: cache?.nationality ?? null,
        countryCode: cache?.country_code ?? null,
        matches: a.matches,
        minutes: a.minutes,
        wins: a.wins,
        draws: a.draws,
        losses: a.losses,
        gender: a.gender,
      };
    })
    .filter((c) => c.countryCode === code);

  return (
    <div className="space-y-6">
      <Link
        href={`/countries/${code}`}
        className="text-sm text-muted hover:text-accent transition-colors inline-flex items-center gap-1.5"
      >
        <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
            clipRule="evenodd"
          />
        </svg>
        Back to {countryName}
      </Link>

      <h1 className="text-2xl font-bold text-white">Coaches from {countryName}</h1>

      <div className="bg-card rounded-xl p-5 border border-card-border">
        {coachesFromCountry.length === 0 ? (
          <p className="text-muted text-center py-6">
            No watched coaches with {countryName} nationality yet.
          </p>
        ) : (
          <CoachStatsTable coaches={coachesFromCountry} pageSize={null} />
        )}
      </div>
    </div>
  );
}
