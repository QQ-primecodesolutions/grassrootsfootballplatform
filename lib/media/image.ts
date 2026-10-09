/**
 * Uploaded logos (pure). Only PNG and JPEG are stored: both render in graphics (Satori) and
 * every browser. SVG is refused because it can carry scripts. The type is decided by the
 * file's first bytes, never by its name or the browser's claim.
 */

export const MAX_MEDIA_BYTES = 1_500_000;

export type MediaType = "image/png" | "image/jpeg";

export const MEDIA_EXTENSION: Record<MediaType, "png" | "jpg"> = { "image/png": "png", "image/jpeg": "jpg" };

export function sniffImageType(bytes: Uint8Array): MediaType | null {
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length >= 8 && png.every((b, i) => bytes[i] === b)) return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  return null;
}

/** "/media/batho-pele/{uuid}.png": the public path of an uploaded image. */
export function mediaPath(orgSlug: string, id: string, type: MediaType): string {
  return `/media/${orgSlug}/${id}.${MEDIA_EXTENSION[type]}`;
}

const MEDIA_PATH = /^\/media\/([a-z0-9]+(?:-[a-z0-9]+)*)\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.(png|jpg)$/;

export function parseMediaPath(path: string): { orgSlug: string; id: string; ext: "png" | "jpg" } | null {
  const m = MEDIA_PATH.exec(path);
  return m ? { orgSlug: m[1]!, id: m[2]!, ext: m[3] as "png" | "jpg" } : null;
}

/** "{uuid}.png" → the id and extension, for the media route. */
export function parseMediaFile(file: string): { id: string; ext: "png" | "jpg" } | null {
  const parsed = parseMediaPath(`/media/x/${file}`);
  return parsed ? { id: parsed.id, ext: parsed.ext } : null;
}

/**
 * Logo values the forms accept: an uploaded image (/media/…), a file shipped with the app
 * (/brand/…), or a full https:// link.
 */
export function isAcceptedLogoValue(value: string): boolean {
  if (parseMediaPath(value)) return true;
  if (/^\/brand\/[\w.-]+\.(png|jpe?g|webp|svg)$/i.test(value)) return true;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}
