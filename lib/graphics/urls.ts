import { createHash } from "node:crypto";
import type { GraphicSize } from "./sizes";

/**
 * Content version for graphic URLs: a short hash of exactly the data a graphic is drawn
 * from. Any change (a result confirmed, a fixture moved, branding edited) gives new URLs,
 * so CDN and social-media caches can keep graphics for a long time without going stale.
 */
export function graphicVersion(...parts: unknown[]): string {
  return createHash("sha1").update(JSON.stringify(parts)).digest("hex").slice(0, 12);
}

/** A graphic for the admin share panels: view URL and download URL. */
export type GraphicLink = { label: string; href: string; downloadHref: string };

export type GraphicTarget =
  | { kind: "matchday" | "table" | "fixtures"; org: string; competition: string }
  | { kind: "result" | "match"; org: string; matchId: string };

/** Relative URL of a graphic route, e.g. `/graphics/batho-pele/result/{id}?size=square&v=…`. */
export function graphicPath(
  target: GraphicTarget,
  opts: { size?: GraphicSize; v?: string; date?: string | null; download?: boolean } = {},
): string {
  const id = "competition" in target ? target.competition : target.matchId;
  const params = new URLSearchParams();
  if (opts.size && opts.size !== "portrait") params.set("size", opts.size);
  if (opts.date) params.set("date", opts.date);
  if (opts.v) params.set("v", opts.v);
  if (opts.download) params.set("download", "1");
  const query = params.toString();
  return `/graphics/${encodeURIComponent(target.org)}/${target.kind}/${encodeURIComponent(id)}${query ? `?${query}` : ""}`;
}
