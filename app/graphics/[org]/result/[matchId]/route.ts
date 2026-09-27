import type { NextRequest } from "next/server";
import { renderMatchGraphic } from "@/lib/graphics/render";
import { badRequestResponse, notFoundResponse, pngResponse } from "@/lib/graphics/response";
import { parseGraphicQuery } from "@/lib/graphics/sizes";

/** Full-time result. 404 unless the match is completed and confirmed. */
export async function GET(req: NextRequest, ctx: RouteContext<"/graphics/[org]/result/[matchId]">) {
  const { org, matchId } = await ctx.params;
  const query = parseGraphicQuery(req.nextUrl.searchParams);
  if (!query) return badRequestResponse();
  const graphic = await renderMatchGraphic(org, matchId, query.size, true);
  return graphic ? pngResponse(graphic, query) : notFoundResponse();
}
