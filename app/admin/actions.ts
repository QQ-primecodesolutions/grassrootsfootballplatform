"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentAdmin } from "@/lib/auth";
import { passwordMatches } from "@/lib/auth/password";
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "@/lib/auth/session";
import { adminScopeForOrg, listOrganisationsForAdmin } from "@/lib/db/queries/admin";
import { getAuthEnv } from "@/lib/env";

export type LoginState = { error: string | null };

const loginSchema = z.object({
  password: z.string().min(1, "Enter the password").max(200),
  next: z.string().optional(),
});

/** Only allow redirects back into the admin area (no open redirects). */
function safeNext(next: string | undefined): string {
  return next && /^\/admin(\/[\w\-/]*)?(\?[\w\-=&%.]*)?$/.test(next) ? next : "/admin";
}

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({ password: formData.get("password"), next: formData.get("next") ?? undefined });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Enter the password" };

  let env: ReturnType<typeof getAuthEnv>;
  try {
    env = getAuthEnv();
  } catch (e) {
    // Missing or example ADMIN_PASSWORD / AUTH_SECRET: say so instead of crashing the form.
    console.error("[admin] login unavailable:", e instanceof Error ? e.message : e);
    return { error: "Admin login isn't set up on this server: set ADMIN_PASSWORD and AUTH_SECRET, then redeploy." };
  }
  if (!passwordMatches(parsed.data.password, env.ADMIN_PASSWORD)) {
    // Slow down guessing. Real rate limiting comes with real auth.
    await new Promise((r) => setTimeout(r, 800));
    return { error: "That password isn't right." };
  }

  const orgs = await listOrganisationsForAdmin();
  const first = orgs[0];
  if (!first) return { error: "No organisations exist yet. Run pnpm db:seed." };

  const token = await signSession({ sub: "admin", orgId: first.id }, env.AUTH_SECRET);
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions());
  redirect(safeNext(parsed.data.next));
}

export async function logout(): Promise<void> {
  (await cookies()).delete({ name: SESSION_COOKIE, path: "/admin" });
  redirect("/admin/login");
}

/** Switch the organisation the admin is working in (re-signs the session). */
export async function switchOrganisation(formData: FormData): Promise<void> {
  await getCurrentAdmin();
  const orgId = z.uuid().safeParse(formData.get("orgId"));
  if (!orgId.success) return;
  const target = await adminScopeForOrg(orgId.data);
  if (!target) return;
  const token = await signSession({ sub: "admin", orgId: target.org.id }, getAuthEnv().AUTH_SECRET);
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions());
  redirect("/admin");
}
