import Link from "next/link";
import { getAllMatches } from "@/lib/db";
import HomeMatchFeed from "@/components/HomeMatchFeed";

export const dynamic = "force-dynamic";

export default function AllMatchesPage() {
  const matches = getAllMatches();

  return (
    <div className="space-y-6">
      <Link href="/" className="text-sm text-muted hover:text-accent transition-colors inline-flex items-center gap-1.5">
        <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
        </svg>
        Back to feed
      </Link>

      <h1 className="text-2xl font-bold text-white">All Matches</h1>

      {matches.length === 0 ? (
        <p className="text-muted">No matches watched yet.</p>
      ) : (
        <HomeMatchFeed matches={matches} pageSize={null} />
      )}
    </div>
  );
}
