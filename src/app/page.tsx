import { getAllMatches } from "@/lib/db";
import MatchCard from "@/components/MatchCard";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default function Home() {
  const matches = getAllMatches();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Match Feed</h1>
        <Link
          href="/add"
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-4 py-2 rounded-lg transition-colors"
        >
          + Add Match
        </Link>
      </div>

      {matches.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-slate-400 text-lg">No matches watched yet.</p>
          <Link href="/add" className="text-emerald-400 hover:text-emerald-300 mt-2 inline-block">
            Add your first match
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {matches.map((match) => (
            <MatchCard key={match.id} match={match} />
          ))}
        </div>
      )}
    </div>
  );
}
