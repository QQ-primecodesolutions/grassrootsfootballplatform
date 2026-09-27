import type { NextRequest } from "next/server";
import { renderFixturesGraphic } from "@/lib/graphics/render";
import { badRequestResponse, notFoundResponse, pngResponse } from "@/lib/graphics/response";
import { parseGraphicQuery } from "@/lib/graphics/sizes";

/** Fixtures on ?date= (default: the next date with a scheduled or postponed match). */
export async function GET(req: NextRequest, ctx: RouteContext<"/graphics/[org]/fixtures/[competition]">) {
  const { org, competition } = await ctx.params;
  const query = parseGraphicQuery(req.nextUrl.searchParams);
  if (!query) return badRequestResponse();
  const graphic = await renderFixturesGraphic(org, competition, query.size, query.date);
  return graphic ? pngResponse(graphic, query) : notFoundResponse();
}
