import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getCompetitionData, listCompetitions } from "@/lib/db/queries";
import { publicEnv } from "@/lib/env";
import { competitionOgTarget, ogImageMetadata, versionOf } from "@/lib/graphics/links";
import { PlatformCredit } from "@/components/public/PlatformCredit";
import { directoryCard } from "@/lib/public/directory";
import { facebookUrl } from "@/lib/public/links";
import { brandStyle, requireOrg } from "@/lib/public/org";

export async function generateMetadata({ params }: LayoutProps<"/[org]">): Promise<Metadata> {
  const { org: slug } = await params;
  const { org, scope } = await requireOrg(slug);
  const competitions = await listCompetitions(scope);
  // A parent league's brand leads when the featured competition has its own logo (see directoryCard).
  const brand = directoryCard(org, competitions);
  const short = brand.runBy ? brand.title : (org.shortName ?? org.name);
  const [first] = competitions;
  const featured = first ? await getCompetitionData(scope, first.slug) : null;
  return {
    title: { default: brand.title, template: `%s · ${short}` },
    description: brand.runBy
      ? `Tables, fixtures and results from ${brand.title}, run by ${brand.runBy}.`
      : (org.tagline ?? `Tables, fixtures and results from ${org.name}.`),
    openGraph: { siteName: brand.title },
    // Default preview for the organisation's pages: its featured competition's table.
    ...(featured
      ? ogImageMetadata(competitionOgTarget(org.slug, featured, "table"), versionOf(org, featured), brand.title, brand.title)
      : {}),
  };
}

/**
 * Organisation frame. `params` is awaited inside a Suspense boundary so every
 * route under /[org] gets an instant App Shell (Cache Components).
 */
export default function OrgLayout({ children, params }: LayoutProps<"/[org]">) {
  return (
    <Suspense fallback={<ShellSkeleton />}>
      <OrgFrame params={params}>{children}</OrgFrame>
    </Suspense>
  );
}

async function OrgFrame({ params, children }: Pick<LayoutProps<"/[org]">, "params" | "children">) {
  const { org: slug } = await params;
  const { org, scope } = await requireOrg(slug);
  const brand = directoryCard(org, await listCompetitions(scope));
  const facebook = facebookUrl(org.socialLinks);
  const initials = (org.shortName ?? org.name)
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();

  return (
    <div style={brandStyle(org)} className="flex min-h-full flex-1 flex-col bg-page text-ink">
      <header className="bg-brand text-on-brand">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Link href={`/${org.slug}`} className="flex min-w-0 items-center gap-3">
            {brand.logoUrl ? (
              // Plain <img>: organiser-supplied URLs on any host; small and cached by the browser.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={brand.logoUrl} alt="" height={40} className="h-10 w-auto max-w-24 shrink-0 rounded bg-white object-contain p-0.5" />
            ) : (
              <span
                aria-hidden
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-on-brand font-display text-sm font-bold text-brand"
              >
                {initials}
              </span>
            )}
            <span className="min-w-0">
              <span className="line-clamp-2 font-display text-lg font-bold uppercase leading-tight tracking-wide">
                {brand.title}
              </span>
              {brand.runBy ? (
                <span className="block truncate text-xs opacity-80">Run by {brand.runBy}</span>
              ) : org.tagline ? (
                <span className="block truncate text-xs opacity-80">{org.tagline}</span>
              ) : null}
            </span>
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-5">{children}</main>

      <footer className="mt-8 bg-brand text-on-brand">
        <div className="mx-auto max-w-3xl space-y-1 px-4 py-5 text-center text-xs">
          {org.tagline ? <p className="font-display text-base font-bold uppercase tracking-wide">{org.tagline}</p> : null}
          {org.hashtags.length ? <p className="opacity-90">{org.hashtags.join("  ")}</p> : null}
          {facebook ? (
            <p className="pt-1">
              <a href={facebook} target="_blank" rel="noopener noreferrer" className="inline-block py-2 font-semibold underline">
                Follow {org.shortName ?? org.name} on Facebook
              </a>
            </p>
          ) : null}
          <p className="pt-2 opacity-70">
            Tables are calculated from confirmed results · {publicEnv.NEXT_PUBLIC_APP_NAME}
          </p>
          <PlatformCredit className="opacity-70" />
        </div>
      </footer>
    </div>
  );
}

function ShellSkeleton() {
  return (
    <div className="flex min-h-full flex-1 flex-col" aria-busy="true">
      <div className="h-16 bg-brand" />
      <div className="mx-auto w-full max-w-3xl space-y-3 px-4 py-5">
        <div className="h-7 w-2/3 animate-pulse rounded bg-black/10" />
        <div className="h-10 animate-pulse rounded bg-black/10" />
        <div className="h-64 animate-pulse rounded bg-black/5" />
      </div>
    </div>
  );
}
