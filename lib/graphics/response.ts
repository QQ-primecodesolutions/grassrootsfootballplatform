import type { RenderedGraphic } from "./render";

/**
 * HTTP responses for graphic routes. URLs carrying `v` (a content hash, see
 * `graphicVersion`) change whenever the underlying data does, so the CDN can keep them for
 * a long time. Unversioned URLs are only cached briefly.
 */
export const CACHE_VERSIONED = "public, max-age=3600, s-maxage=2592000, stale-while-revalidate=86400";
export const CACHE_UNVERSIONED = "public, max-age=0, s-maxage=60, stale-while-revalidate=60";

export function pngResponse(graphic: RenderedGraphic, opts: { download: boolean; versioned: boolean }): Response {
  const headers: Record<string, string> = {
    "Content-Type": "image/png",
    "Cache-Control": opts.versioned ? CACHE_VERSIONED : CACHE_UNVERSIONED,
    "X-Content-Type-Options": "nosniff",
  };
  if (opts.download) headers["Content-Disposition"] = `attachment; filename="${graphic.filename}"`;
  return new Response(graphic.bytes as Uint8Array<ArrayBuffer>, { headers });
}

/** Not found / not public yet. Never cached: a fixture can become a confirmed result any moment. */
export function notFoundResponse(): Response {
  return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store", "Content-Type": "text/plain" } });
}

export function badRequestResponse(): Response {
  return new Response("Invalid graphic options", { status: 400, headers: { "Cache-Control": "no-store", "Content-Type": "text/plain" } });
}
