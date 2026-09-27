import { asc, eq } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { ORGANISATIONS_TAG, orgTag } from "@/lib/cache/tags";
import { getDb } from "@/lib/db/client";
import { organisations, type SocialLinks } from "@/lib/db/schema";

/**
 * An organisation scope. Every tenant query takes one as its first argument, and it
 * can only be obtained from `resolveOrgBySlug` (public) or `getCurrentAdmin` (admin),
 * so pages can't query another organisation's data by accident.
 */
declare const orgScopeBrand: unique symbol;
export type OrgScope = { readonly id: string; readonly slug: string; readonly [orgScopeBrand]: true };

/** Internal: only the query layer and auth may mint scopes. */
export function unsafeOrgScope(id: string, slug: string): OrgScope {
  return { id, slug } as OrgScope;
}

export type PublicOrganisation = {
  id: string;
  slug: string;
  name: string;
  shortName: string | null;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string | null;
  textColor: string;
  backgroundColor: string;
  tagline: string | null;
  hashtags: string[];
  socialLinks: SocialLinks;
};

function toPublic(row: typeof organisations.$inferSelect): PublicOrganisation {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    shortName: row.shortName,
    logoUrl: row.logoUrl,
    primaryColor: row.primaryColor,
    secondaryColor: row.secondaryColor,
    accentColor: row.accentColor,
    textColor: row.textColor,
    backgroundColor: row.backgroundColor,
    tagline: row.tagline,
    hashtags: row.hashtags,
    socialLinks: row.socialLinks,
  };
}

export async function listOrganisations(): Promise<PublicOrganisation[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(ORGANISATIONS_TAG);
  const rows = await getDb().select().from(organisations).orderBy(asc(organisations.name));
  return rows.map(toPublic);
}

async function getOrganisationBySlug(slug: string): Promise<PublicOrganisation | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(ORGANISATIONS_TAG);
  const [row] = await getDb().select().from(organisations).where(eq(organisations.slug, slug)).limit(1);
  if (!row) return null;
  cacheTag(orgTag(row.id));
  return toPublic(row);
}

/** Resolve a public URL's organisation slug to its data and a query scope. */
export async function resolveOrgBySlug(
  slug: string,
): Promise<{ org: PublicOrganisation; scope: OrgScope } | null> {
  const org = await getOrganisationBySlug(slug);
  return org ? { org, scope: unsafeOrgScope(org.id, org.slug) } : null;
}
