import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCompetitionData } from "@/lib/db/queries";
import { competitionOgTarget, ogImageMetadata, versionOf } from "@/lib/graphics/links";
import { competitionSubtitle } from "@/lib/match/public";
import { requireOrg } from "./org";

/** Load org + competition for a /[org]/[competition] route, or 404. */
export async function requireCompetition(orgSlug: string, competitionSlug: string) {
  const { org, scope } = await requireOrg(orgSlug);
  const data = await getCompetitionData(scope, competitionSlug);
  if (!data) notFound();
  return { org, scope, data };
}

export async function competitionMetadata(
  orgSlug: string,
  competitionSlug: string,
  tab: "table" | "fixtures" | "results",
): Promise<Metadata> {
  const { org, data } = await requireCompetition(orgSlug, competitionSlug);
  const c = data.competition;
  const section = tab === "table" ? (c.type === "league" ? "Table" : c.type === "group_knockout" ? "Groups" : "Matches") : tab === "fixtures" ? "Fixtures" : "Results";
  const name = [c.name, competitionSubtitle(c)].filter(Boolean).join(" — ");
  return {
    title: `${section} · ${name}`,
    description: `${section} for ${name} (${c.seasonName}), from ${org.name}.`,
    ...ogImageMetadata(competitionOgTarget(org.slug, data, tab), versionOf(org, data), `${section}: ${name}`, org.name),
  };
}
