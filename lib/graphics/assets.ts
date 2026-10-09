import { readFile } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";
import { getPublicMedia } from "@/lib/db/queries/media";
import { parseMediaPath } from "@/lib/media/image";

/** Font family name used by every graphic. */
export const GRAPHIC_FONT = "Barlow Condensed";

type FontOption = { name: string; data: Buffer; weight: 600 | 700 | 800; style: "normal" | "italic" };

let fonts: Promise<FontOption[]> | null = null;

/** Barlow Condensed (SIL OFL, assets/fonts/OFL.txt). Read once per server instance. */
export function loadGraphicFonts(): Promise<FontOption[]> {
  fonts ??= Promise.all(
    (
      [
        ["SemiBold", 600, "normal"],
        ["Bold", 700, "normal"],
        ["ExtraBold", 800, "normal"],
        ["ExtraBoldItalic", 800, "italic"],
      ] as const
    ).map(async ([file, weight, style]) => ({
      name: GRAPHIC_FONT,
      data: await readFile(join(process.cwd(), "assets/fonts", `BarlowCondensed-${file}.ttf`)),
      weight,
      style,
    })),
  ).catch((e: unknown) => {
    fonts = null;
    throw e;
  });
  return fonts;
}

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};
const MAX_BYTES = 1_500_000;

/**
 * A logo as a data URI, or null if it can't be loaded (the graphic then falls back to a
 * text lockup instead of failing). Accepts uploaded images ("/media/{org}/{id}.png", read
 * from the database), files under `public/` ("/brand/logo.png") or https URLs (3 s timeout).
 */
export async function loadLogo(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const uploaded = parseMediaPath(url);
    if (uploaded) {
      const found = await getPublicMedia(uploaded.orgSlug, uploaded.id);
      return found ? `data:${found.contentType};base64,${found.bytes.toString("base64")}` : null;
    }
    if (url.startsWith("/")) {
      const root = join(process.cwd(), "public");
      const path = normalize(join(root, url));
      if (!path.startsWith(root + sep)) return null;
      const type = MIME[extname(path).toLowerCase()];
      if (!type) return null;
      const bytes = await readFile(path);
      return bytes.length <= MAX_BYTES ? `data:${type};base64,${bytes.toString("base64")}` : null;
    }
    if (!url.startsWith("https://")) return null;
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    const type = res.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
    if (!res.ok || !Object.values(MIME).includes(type)) return null;
    const bytes = Buffer.from(await res.arrayBuffer());
    return bytes.length <= MAX_BYTES ? `data:${type};base64,${bytes.toString("base64")}` : null;
  } catch {
    return null;
  }
}
