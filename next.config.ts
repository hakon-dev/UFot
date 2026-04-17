import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "crests.football-data.org",
      },
    ],
  },
};

export default nextConfig;
