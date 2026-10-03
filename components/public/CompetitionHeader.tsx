import Link from "next/link";
import { competitionSubtitle } from "@/lib/match/public";
import { facebookUrl } from "@/lib/public/links";
import type { CompetitionSummary } from "@/lib/db/queries";

export type CompetitionTab = "table" | "fixtures" | "results";

/** Competition title plus Table / Fixtures / Results tabs (plain links: no client JS). */
export function CompetitionHeader({
  orgSlug,
  competition,
  active,
}: {
  orgSlug: string;
  competition: CompetitionSummary;
  active: CompetitionTab;
}) {
  const base = `/${orgSlug}/${competition.slug}`;
  const tabs: { key: CompetitionTab; label: string; href: string }[] = [
    { key: "table", label: competition.type === "league" ? "Table" : "Matches", href: base },
    { key: "fixtures", label: "Fixtures", href: `${base}/fixtures` },
    { key: "results", label: "Results", href: `${base}/results` },
  ];
  const subtitle = competitionSubtitle(competition);
  const facebook = facebookUrl(competition.socialLinks);

  return (
    <header className="mb-4">
      <h1 className="font-display text-2xl font-bold uppercase leading-tight tracking-wide">{competition.name}</h1>
      <p className="text-sm text-muted">
        {[subtitle, competition.seasonName].filter(Boolean).join(" · ")}
        {competition.slogan ? <span className="italic"> — {competition.slogan}</span> : null}
      </p>
      {facebook ? (
        <a href={facebook} target="_blank" rel="noopener noreferrer" className="inline-block py-1 text-sm font-semibold underline">
          League page on Facebook
        </a>
      ) : null}
      <nav aria-label="Competition sections" className="mt-3 grid grid-cols-3 gap-1 rounded-lg bg-black/5 p-1">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={t.href}
            aria-current={t.key === active ? "page" : undefined}
            className={`rounded-md py-2.5 text-center text-sm font-semibold ${
              t.key === active ? "bg-brand text-on-brand shadow-sm" : "text-ink hover:bg-black/5"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
