import type { CompetitionSummary, PublicOrganisation } from "@/lib/db/queries";

/**
 * How an organisation appears on the homepage (pure).
 *
 * When its featured competition carries its own brand (a logo), that brand leads: e.g. Batho
 * Pele runs the Open league of the QwaQwa Development League, so the card shows the QDL name and
 * logo, "run by" Batho Pele. Otherwise the organisation itself is shown.
 */
export type DirectoryCard = {
  id: string;
  slug: string;
  title: string;
  /** The organisation, when the card leads with a competition brand. */
  runBy: string | null;
  tagline: string | null;
  logoUrl: string | null;
  primaryColor: string;
  /** Extra words the search box matches (e.g. the organisation's names). */
  searchText: string;
};

export function directoryCard(org: PublicOrganisation, competitions: CompetitionSummary[]): DirectoryCard {
  const featured = competitions.find((c) => c.isFeatured) ?? null;
  const branded = featured?.logoUrl ? featured : null;
  return {
    id: org.id,
    slug: org.slug,
    title: branded ? branded.name : org.name,
    runBy: branded ? org.name : null,
    tagline: branded ? (branded.slogan ?? org.tagline) : org.tagline,
    logoUrl: branded ? branded.logoUrl : org.logoUrl,
    primaryColor: org.primaryColor,
    searchText: [org.name, org.shortName, org.tagline, branded?.name, branded?.slogan].filter(Boolean).join(" "),
  };
}
