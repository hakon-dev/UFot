import { getAllMatches } from "@/lib/db";
import HomeMatchFeed from "@/components/HomeMatchFeed";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default function Home() {
  const matches = getAllMatches();

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
