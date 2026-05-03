import Link from "next/link";

export default function SectionHeader({
  title,
  seeAllHref,
}: {
  title: string;
  seeAllHref?: string | null;
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      {seeAllHref ? (
        <Link
          href={seeAllHref}
          className="text-xs text-muted hover:text-accent transition-colors inline-flex items-center gap-1"
        >
          See all
          <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M7.293 15.707a1 1 0 010-1.414L11.586 10 7.293 5.707a1 1 0 011.414-1.414l5 5a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0z" clipRule="evenodd" />
          </svg>
        </Link>
      ) : null}
    </div>
  );
}
