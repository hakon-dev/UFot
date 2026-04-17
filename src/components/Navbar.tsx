"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="text-xl font-bold text-accent">
            UFot
          </Link>
          <div className="flex gap-1">
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
