import type { NextRequest } from "next/server";
import { getPublicMedia } from "@/lib/db/queries/media";
import { MEDIA_EXTENSION, parseMediaFile } from "@/lib/media/image";

/**
 * An uploaded logo. An id's bytes never change (a new upload gets a new id), so browsers
 * and the CDN may keep it for a year.
 */
export async function GET(_req: NextRequest, ctx: RouteContext<"/media/[org]/[file]">) {
  const { org, file } = await ctx.params;
  const parsed = parseMediaFile(file);
  const found = parsed ? await getPublicMedia(org, parsed.id) : null;
  if (!parsed || !found || MEDIA_EXTENSION[found.contentType] !== parsed.ext) {
    return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  return new Response(new Uint8Array(found.bytes), {
    headers: {
      "Content-Type": found.contentType,
      "Content-Length": String(found.bytes.length),
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'",
    },
  });
}
