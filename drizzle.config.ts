import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";
import { withVerifiedTls } from "./lib/db/url";

// What the shell/Vercel set explicitly, before .env files are merged in.
const explicitUrl = process.env.DATABASE_URL;
const explicitUnpooled = process.env.DATABASE_URL_UNPOOLED;

// Load .env / .env.local the same way Next.js does.
loadEnvConfig(process.cwd());

// `generate` works without a database; `migrate`, `push` and `studio` need DATABASE_URL.
// Neon recommends a direct (unpooled) connection for migrations; the Vercel/Neon
// integration provides it as DATABASE_URL_UNPOOLED. A DATABASE_URL given on the command
// line (e.g. `DATABASE_URL=… pnpm db:migrate`) must never be overridden by an unpooled URL
// from .env.local, which would silently migrate a different database.
const url = withVerifiedTls(
  explicitUrl && !explicitUnpooled
    ? explicitUrl
    : process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || "",
);
if (!url && !process.argv.includes("generate")) {
  throw new Error(
    "DATABASE_URL (or DATABASE_URL_UNPOOLED) is missing. Set it in .env.local, or on Vercel connect Neon to this environment. See README → Environment variables.",
  );
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/db/schema.ts",
  out: "./db/migrations",
  dbCredentials: { url },
  strict: true,
  verbose: true,
});
