import Link from "next/link";
import type { RankItem, EntityKind } from "@/lib/rank";

const OVERALL_TABLE_HREF: Record<EntityKind, string> = {
  player: "/stats/players",
  team: "/stats/teams",
  national_team: "/stats/national-teams",
  competition: "/stats/competitions",
  stadium: "/stadiums/total",
  coach: "/coaches/total",
  referee: "/referees/total",
};

const ENTITY_NOUN: Record<EntityKind, string> = {
  player: "player",
  team: "team",
  national_team: "national team",
  competition: "competition",
  stadium: "stadium",
  coach: "coach",
  referee: "referee",
};

function hrefFor(item: RankItem): string {
  if (item.scope?.kind === "country" && item.scope.countryCode) {
    return `/countries/${item.scope.countryCode}`;
  }
  if (item.scope?.kind === "in-person") return "/stadiums/in-person";
  return OVERALL_TABLE_HREF[item.entity];
}

function Descriptor({ item }: { item: RankItem }) {
  const isStadiumInPerson = item.entity === "stadium" && item.scope?.kind === "in-person";
  const verb = isStadiumInPerson ? "visited" : "watched";
  const head = `most ${verb} ${ENTITY_NOUN[item.entity]}`;

  if (!item.scope) {
    // "Most watched national team" already reads as a global statement (there's no plain
    // "national team" the user could mean instead) — the "in total" suffix is redundant.
    return <>{head}{item.entity === "national_team" ? "" : " in total"}</>;
  }

  if (item.scope.kind === "in-person") {
    return <>{head} in person</>;
  }

  if (item.scope.kind === "region") {
    return <>{head} in {item.scope.name}</>;
  }

  return (
    <>
      {head} from{" "}
      {item.scope.countryCode && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`https://flagcdn.com/${item.scope.countryCode}.svg`}
          alt=""
          className="inline-block w-4 h-3 object-cover rounded-[1px] align-[-2px] mx-0.5"
        />
      )}
      <span className="font-semibold text-slate-100">{item.scope.countryName}</span>
    </>
  );
}

export default function RankLine({ items }: { items: RankItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {items.map((item, i) => (
        <Link
          key={i}
          href={hrefFor(item)}
          className="inline-flex items-center gap-2 rounded-lg border border-card-border bg-surface/60 pl-2 pr-3 py-1 transition-colors hover:bg-card-border/60 hover:border-accent/40"
        >
          <span className="text-2xl font-bold text-accent tabular-nums leading-none px-0.5">
            #{item.rank}
          </span>
          <span className="text-xs text-slate-200 leading-tight">
            <Descriptor item={item} />
          </span>
        </Link>
      ))}
    </div>
  );
}
