import type { CompetitionSummary, PublicOrganisation } from "@/lib/db/queries";

/**
 * How an organisation appears on the homepage (pure).
 *
 * When its featured competition carries its own brand (a logo), that logo leads:
 * - the organisation IS that brand (the competition's name starts with the organisation's, e.g.
 *   "QwaQwa Development League" running "QwaQwa Development League Open"): show the
 *   organisation's name with the competition's logo, and no "run by" line;
 * - a partner runs it (e.g. Batho Pele running the QDL Open): show the competition's name and
 *   logo, "run by" the partner.
 * Otherwise the organisation itself is shown.
 */

const simplify = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

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
  const ownBrand = branded ? simplify(branded.name).startsWith(simplify(org.name)) : false;
  return {
    id: org.id,
    slug: org.slug,
    title: branded && !ownBrand ? branded.name : org.name,
    runBy: branded && !ownBrand ? org.name : null,
    tagline: branded ? (branded.slogan ?? org.tagline) : org.tagline,
    logoUrl: branded ? branded.logoUrl : org.logoUrl,
    primaryColor: org.primaryColor,
    searchText: [org.name, org.shortName, org.tagline, branded?.name, branded?.slogan].filter(Boolean).join(" "),
  };
}
