"use client";

import { useState } from "react";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function PlayerPhoto({
  src,
  name,
  size = "md",
}: {
  src: string;
  name: string;
  size?: "sm" | "md" | "lg";
}) {
  const [failed, setFailed] = useState(false);
  const dims =
    size === "lg" ? "w-16 h-16 text-base" : size === "sm" ? "w-6 h-6 text-[9px]" : "w-10 h-10 text-xs";
  return (
    <div className={`${dims} rounded-full bg-surface ring-2 ring-accent/40 overflow-hidden flex items-center justify-center shrink-0`}>
      {failed ? (
        <span className="font-bold text-muted">{initials(name)}</span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={name}
          className="w-full h-full object-cover"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}
