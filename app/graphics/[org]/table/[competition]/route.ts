import type { NextRequest } from "next/server";
import { renderTableGraphic } from "@/lib/graphics/render";
import { badRequestResponse, notFoundResponse, pngResponse } from "@/lib/graphics/response";
import { parseGraphicQuery } from "@/lib/graphics/sizes";

/** League table graphic as at ?date= (default: the latest result day). */
export async function GET(req: NextRequest, ctx: RouteContext<"/graphics/[org]/table/[competition]">) {
  const { org, competition } = await ctx.params;
  const query = parseGraphicQuery(req.nextUrl.searchParams);
  if (!query) return badRequestResponse();
  const graphic = await renderTableGraphic(org, competition, "table", query.size, query.date);
  return graphic ? pngResponse(graphic, query) : notFoundResponse();
}
