import { z } from "zod";

/**
 * Environment validation. Parsed lazily so `next build`, tests and scripts only
 * require the variables they actually touch.
 */

const serverSchema = z.object({
  DATABASE_URL: z.url({ error: "DATABASE_URL is missing or not a valid postgres:// URL" }),
});

const authSchema = z.object({
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),
});

const publicSchema = z.object({
  NEXT_PUBLIC_APP_NAME: z.string().min(1).default("Grassroots Football"),
  NEXT_PUBLIC_SITE_URL: z.url().optional(),
});

function parse<T extends z.ZodType>(schema: T, source: Record<string, string | undefined>): z.infer<T> {
  const result = schema.safeParse(source);
  if (!result.success) {
    const details = result.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment variables:\n${details}\nSee .env.example.`);
  }
  return result.data;
}

let dbEnv: z.infer<typeof serverSchema> | undefined;
export function getDbEnv() {
  dbEnv ??= parse(serverSchema, process.env);
  return dbEnv;
}

/** Values copied from .env.example; refused in production. */
const EXAMPLE_SECRETS = new Set(["replace-with-a-long-random-string-of-32-plus-chars"]);

let authEnv: z.infer<typeof authSchema> | undefined;
export function getAuthEnv() {
  if (!authEnv) {
    const parsed = parse(authSchema, process.env);
    if (
      process.env.NODE_ENV === "production" &&
      process.env.VERCEL_ENV !== "preview" &&
      EXAMPLE_SECRETS.has(parsed.AUTH_SECRET)
    ) {
      throw new Error("AUTH_SECRET still has the example value from .env.example. Set a real one.");
    }
    authEnv = parsed;
  }
  return authEnv;
}

/**
 * NEXT_PUBLIC_* values are inlined at build time, so they must be referenced
 * literally (not via process.env[key]).
 */
export const publicEnv = parse(publicSchema, {
  NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
});

/**
 * Absolute site origin for OG images and share links: the deployment's own URL on Vercel
 * preview deployments, otherwise NEXT_PUBLIC_SITE_URL, then the production domain.
 */
export function siteUrl(): string {
  if (process.env.VERCEL_ENV === "preview") {
    const preview = process.env.VERCEL_BRANCH_URL || process.env.VERCEL_URL;
    if (preview) return `https://${preview}`;
  }
  if (publicEnv.NEXT_PUBLIC_SITE_URL) return publicEnv.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
}
