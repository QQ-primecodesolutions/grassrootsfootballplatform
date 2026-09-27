import { z } from "zod";

/** Output sizes: Facebook/Instagram portrait (default), square, and Open Graph. */
export const GRAPHIC_SIZES = {
  portrait: { width: 1080, height: 1350 },
  square: { width: 1080, height: 1080 },
  og: { width: 1200, height: 630 },
} as const;

export type GraphicSize = keyof typeof GRAPHIC_SIZES;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const querySchema = z.object({
  size: z.enum(["portrait", "square", "og"]).default("portrait"),
  download: z
    .enum(["1", "0"])
    .optional()
    .transform((v) => v === "1"),
  date: z.string().regex(ISO_DATE).optional(),
  /** Content version (see graphicVersion); only used to key caches. */
  v: z
    .string()
    .regex(/^[0-9a-f]{1,32}$/)
    .optional(),
});

export type GraphicQuery = {
  size: GraphicSize;
  download: boolean;
  date: string | null;
  versioned: boolean;
};

/** Parse `?size=&download=&date=&v=`. Null for invalid input (the route answers 400). */
export function parseGraphicQuery(params: URLSearchParams): GraphicQuery | null {
  const raw: Record<string, string> = {};
  for (const key of ["size", "download", "date", "v"]) {
    const value = params.get(key);
    if (value !== null && value !== "") raw[key] = value;
  }
  const parsed = querySchema.safeParse(raw);
  if (!parsed.success) return null;
  const { size, download, date, v } = parsed.data;
  return { size, download, date: date ?? null, versioned: v !== undefined };
}
