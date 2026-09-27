import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";

// Load .env / .env.local the same way Next.js does.
loadEnvConfig(process.cwd());

// `generate` works without a database; `migrate`, `push` and `studio` need DATABASE_URL.
// Neon recommends a direct (unpooled) connection for migrations; the Vercel/Neon
// integration provides it as DATABASE_URL_UNPOOLED.
const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || "";

export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/db/schema.ts",
  out: "./db/migrations",
  dbCredentials: { url },
  strict: true,
  verbose: true,
});
