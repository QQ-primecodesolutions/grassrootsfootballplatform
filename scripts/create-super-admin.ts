/**
 * pnpm admin:super --email you@example.com --name "Your Name" [--site https://your-domain]
 *
 * Creates (or promotes) a platform super admin and prints a one-time link to choose a
 * password: an invite link for a new account, a reset link if they already have one.
 * Use the same command to recover a super admin who forgot their password.
 * --site sets the link's origin (default: NEXT_PUBLIC_SITE_URL / the production URL).
 */
import { createRequire } from "node:module";
import { parseArgs } from "node:util";

// @next/env is CommonJS; load it via require so named exports resolve under ESM.
const { loadEnvConfig } = createRequire(import.meta.url)("@next/env") as typeof import("@next/env");
loadEnvConfig(process.cwd());

const { createDb } = await import("@/lib/db/client");
const { getDbEnv, siteUrl } = await import("@/lib/env");
const { ensureSuperAdmin, issuePasswordLink } = await import("@/lib/db/queries/platform");
const { inviteSchema } = await import("@/lib/platform/organisation-input");
const { setPasswordPath, LINK_LIFETIME_HOURS } = await import("@/lib/auth/tokens");

const { values } = parseArgs({
  options: { email: { type: "string" }, name: { type: "string" }, site: { type: "string" } },
});
const input = inviteSchema.safeParse({ email: values.email ?? "", name: values.name ?? "" });
if (!input.success) {
  console.error(`${input.error.issues[0]?.message}\nUsage: pnpm admin:super --email you@example.com --name "Your Name"`);
  process.exit(1);
}

const { db, close } = createDb(getDbEnv().DATABASE_URL);
try {
  const { userId, hasPassword } = await ensureSuperAdmin(input.data, db);
  const purpose = hasPassword ? "reset" : "invite";
  const token = await issuePasswordLink(null, userId, purpose, new Date(), db);
  const origin = (values.site ?? siteUrl()).replace(/\/$/, "");
  console.log(`${input.data.name} <${input.data.email}> is a super admin.`);
  console.log(`Open this link to choose ${hasPassword ? "a new" : "your"} password (works once, expires in ${LINK_LIFETIME_HOURS[purpose]} hours):`);
  console.log(`\n  ${origin}${setPasswordPath(token)}\n`);
  console.log("Don't share it or paste it anywhere public.");
} finally {
  await close();
}
