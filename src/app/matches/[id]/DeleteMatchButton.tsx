"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function DeleteMatchButton({ matchId }: { matchId: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm("Delete this match? This permanently removes it from your feed and stats.")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/matches/${matchId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      router.push("/");
      router.refresh();
    } catch {
      setDeleting(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={deleting}
      className="text-xs text-muted hover:text-red-400 transition-colors inline-flex items-center gap-1.5 disabled:opacity-40"
      aria-label="Delete match"
    >
      <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
      </svg>
      {deleting ? "Deleting..." : "Delete match"}
    </button>
  );
}
