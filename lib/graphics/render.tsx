import { cacheLife, cacheTag } from "next/cache";
import { ImageResponse } from "next/og";
import type { ReactElement } from "react";
import { competitionTag, matchTag, orgTag } from "@/lib/cache/tags";
import { findMatchCompetitionSlug, getCompetitionData, resolveOrgBySlug } from "@/lib/db/queries";
import { isFinal } from "@/lib/match/public";
import { loadGraphicFonts, loadLogo } from "./assets";
import { FixturesGraphic, MatchdayGraphic, MatchGraphic } from "./graphics";
import { fixturesModel, matchCardModel, matchdayModel, type GraphicBrand } from "./model";
import type { Logos } from "./parts";
import { GRAPHIC_SIZES, type GraphicSize } from "./sizes";

/**
 * Renders graphics to PNG bytes. Each loader is a `"use cache"` function tagged with the
 * organisation, competition and (for match graphics) match tags, so the admin actions'
 * `updateTag` calls re-render them on the next request after a change.
 */

export type RenderedGraphic = { bytes: Uint8Array; filename: string };

async function toPng(element: ReactElement, size: GraphicSize): Promise<Uint8Array> {
  const res = new ImageResponse(element, { ...GRAPHIC_SIZES[size], fonts: await loadGraphicFonts() });
  return new Uint8Array(await res.arrayBuffer());
}

async function loadLogos(brand: GraphicBrand): Promise<Logos> {
  const [org, competition, ...sponsors] = await Promise.all([
    loadLogo(brand.orgLogoUrl),
    loadLogo(brand.competitionLogoUrl),
    ...brand.sponsors.map((s) => loadLogo(s.logoUrl)),
  ]);
  return { org: org ?? null, competition: competition ?? null, sponsors };
}

async function loadCompetition(orgSlug: string, competitionSlug: string) {
  const resolved = await resolveOrgBySlug(orgSlug);
  if (!resolved) return null;
  const data = await getCompetitionData(resolved.scope, competitionSlug);
  if (!data) return null;
  cacheTag(orgTag(resolved.org.id), competitionTag(data.competition.id));
  return { org: resolved.org, data };
}

/** Matchday (table + that day's results + top 3) or the table alone. Leagues only. */
export async function renderTableGraphic(
  orgSlug: string,
  competitionSlug: string,
  kind: "matchday" | "table",
  size: GraphicSize,
  date: string | null,
): Promise<RenderedGraphic | null> {
  "use cache";
  cacheLife("hours");
  const loaded = await loadCompetition(orgSlug, competitionSlug);
  if (!loaded || loaded.data.competition.type !== "league") return null;
  const model = matchdayModel(loaded.org, loaded.data, date);
  const logos = await loadLogos(model.brand);
  return {
    bytes: await toPng(<MatchdayGraphic model={model} size={size} logos={logos} panels={kind === "matchday"} />, size),
    filename: `${competitionSlug}-${kind}-${model.date ?? "start"}-${size}.png`,
  };
}

export async function renderFixturesGraphic(
  orgSlug: string,
  competitionSlug: string,
  size: GraphicSize,
  date: string | null,
): Promise<RenderedGraphic | null> {
  "use cache";
  cacheLife("hours");
  const loaded = await loadCompetition(orgSlug, competitionSlug);
  if (!loaded) return null;
  const model = fixturesModel(loaded.org, loaded.data, date);
  const logos = await loadLogos(model.brand);
  return {
    bytes: await toPng(<FixturesGraphic model={model} size={size} logos={logos} />, size),
    filename: `${competitionSlug}-fixtures-${model.date ?? "tbc"}-${size}.png`,
  };
}

/**
 * A match graphic. `requireFinal` (the /result route) returns null unless the result is
 * completed and confirmed; otherwise a preview card is drawn for any state, still without
 * any non-confirmed score.
 */
export async function renderMatchGraphic(
  orgSlug: string,
  matchId: string,
  size: GraphicSize,
  requireFinal: boolean,
): Promise<RenderedGraphic | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(matchTag(matchId));
  const resolved = await resolveOrgBySlug(orgSlug);
  if (!resolved) return null;
  const competitionSlug = await findMatchCompetitionSlug(resolved.scope, matchId);
  if (!competitionSlug) return null;
  const loaded = await loadCompetition(orgSlug, competitionSlug);
  const match = loaded?.data.matches.find((x) => x.id === matchId);
  if (!loaded || !match) return null;
  if (requireFinal && !isFinal(match)) return null;
  const model = matchCardModel(loaded.org, loaded.data, match);
  const logos = await loadLogos(model.brand);
  const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return {
    bytes: await toPng(<MatchGraphic model={model} size={size} logos={logos} />, size),
    filename: `${slug(match.home.shortName || match.home.name)}-v-${slug(match.away.shortName || match.away.name)}-${requireFinal ? "result" : "match"}-${size}.png`,
  };
}
