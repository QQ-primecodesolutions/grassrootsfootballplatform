import { z } from "zod";

/**
 * Environment validation. Parsed lazily so `next build`, tests and scripts only
 * require the variables they actually touch.
 */

const serverSchema = z.object({
  DATABASE_URL: z.url({ error: "DATABASE_URL is missing or not a valid postgres:// URL" }),
});

const authSchema = z.object({
  ADMIN_PASSWORD: z.string().min(8, "ADMIN_PASSWORD must be at least 8 characters"),
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

let authEnv: z.infer<typeof authSchema> | undefined;
export function getAuthEnv() {
  authEnv ??= parse(authSchema, process.env);
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

/** Absolute site origin for OG images and share links. */
export function siteUrl(): string {
  if (publicEnv.NEXT_PUBLIC_SITE_URL) return publicEnv.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
}
