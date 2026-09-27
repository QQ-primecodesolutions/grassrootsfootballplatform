import type { Metadata } from "next";
import { getCompetitionData, resolveOrgBySlug, type CompetitionData, type PublicOrganisation } from "@/lib/db/queries";
import { GRAPHIC_SIZES } from "./sizes";
import { graphicPath, graphicVersion, type GraphicTarget } from "./urls";

/**
 * Versioned graphic links for pages and the admin share panel. The version hashes the
 * same cached data the graphic routes draw from, so a link changes as soon as a result
 * is confirmed or edited.
 */

export function versionOf(org: PublicOrganisation, data: CompetitionData): string {
  return graphicVersion(org, data);
}

/** Version for a competition's graphics, or null if the org or competition doesn't exist. */
export async function competitionGraphicVersion(orgSlug: string, competitionSlug: string): Promise<string | null> {
  const resolved = await resolveOrgBySlug(orgSlug);
  const data = resolved && (await getCompetitionData(resolved.scope, competitionSlug));
  return resolved && data ? versionOf(resolved.org, data) : null;
}

/** The Open Graph graphic that best previews a competition: its table, or fixtures for a cup. */
export function competitionOgTarget(orgSlug: string, data: CompetitionData, tab: "table" | "fixtures" | "results"): GraphicTarget {
  const kind = tab === "fixtures" || data.competition.type !== "league" ? "fixtures" : "table";
  return { kind, org: orgSlug, competition: data.competition.slug };
}

/** `openGraph` + `twitter` metadata pointing at a 1200×630 graphic. */
export function ogImageMetadata(
  target: GraphicTarget,
  v: string,
  alt: string,
  siteName: string,
): Pick<Metadata, "openGraph" | "twitter"> {
  const url = graphicPath(target, { size: "og", v });
  const image = { url, ...GRAPHIC_SIZES.og, alt, type: "image/png" };
  return {
    openGraph: { siteName, images: [image] },
    twitter: { card: "summary_large_image", images: [image] },
  };
}
