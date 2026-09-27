import type { NextRequest } from "next/server";
import { renderTableGraphic } from "@/lib/graphics/render";
import { badRequestResponse, notFoundResponse, pngResponse } from "@/lib/graphics/response";
import { parseGraphicQuery } from "@/lib/graphics/sizes";

/** Matchday graphic: table as at ?date= (default: latest result day), that day's results, top 3. */
export async function GET(req: NextRequest, ctx: RouteContext<"/graphics/[org]/matchday/[competition]">) {
  const { org, competition } = await ctx.params;
  const query = parseGraphicQuery(req.nextUrl.searchParams);
  if (!query) return badRequestResponse();
  const graphic = await renderTableGraphic(org, competition, "matchday", query.size, query.date);
  return graphic ? pngResponse(graphic, query) : notFoundResponse();
}
