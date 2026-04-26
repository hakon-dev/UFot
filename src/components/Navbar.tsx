"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import GlobalSearch from "./GlobalSearch";

const links = [
  { href: "/", label: "Matches" },
  { href: "/add", label: "Add Match" },
  { href: "/stats", label: "Statistics" },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="bg-card border-b border-card-border">
      <div className="max-w-5xl mx-auto px-4">
        <div className="flex items-center gap-4 h-16">
          <Link href="/" className="text-xl font-bold text-accent shrink-0">
            UFot
          </Link>
          <div className="flex-1 flex justify-center">
            <GlobalSearch />
          </div>
          <div className="flex gap-1 shrink-0">
            {links.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-accent text-black"
                      : "text-muted hover:bg-surface hover:text-white"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
