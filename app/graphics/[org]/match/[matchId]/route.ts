import type { NextRequest } from "next/server";
import { renderMatchGraphic } from "@/lib/graphics/render";
import { badRequestResponse, notFoundResponse, pngResponse } from "@/lib/graphics/response";
import { parseGraphicQuery } from "@/lib/graphics/sizes";

/**
 * A match in any state (used for link previews): the result once confirmed, otherwise
 * "vs" with the kickoff, or the status. Never shows a provisional score.
 */
export async function GET(req: NextRequest, ctx: RouteContext<"/graphics/[org]/match/[matchId]">) {
  const { org, matchId } = await ctx.params;
  const query = parseGraphicQuery(req.nextUrl.searchParams);
  if (!query) return badRequestResponse();
  const graphic = await renderMatchGraphic(org, matchId, query.size, false);
  return graphic ? pngResponse(graphic, query) : notFoundResponse();
}
