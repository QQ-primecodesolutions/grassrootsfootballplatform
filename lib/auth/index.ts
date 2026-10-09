import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getSessionUser, resolveAdminOrg, type AdminOrg, type SessionUser } from "@/lib/db/queries/accounts";
import { unsafePlatformScope, type PlatformScope } from "@/lib/db/queries/platform";
import type { OrgScope } from "@/lib/db/queries";
import { getAuthEnv } from "@/lib/env";
import type { OrgRole } from "./roles";
import { SESSION_COOKIE, sessionCookieOptions, signSession, verifySession } from "./session";

export type CurrentUser = { user: SessionUser; orgId: string | null };

export type CurrentAdmin = {
  user: SessionUser;
  scope: OrgScope;
  org: AdminOrg;
  /** The user's role in this organisation. */
  role: OrgRole;
};

/**
 * The signed-in user (once per request). Redirects to the login page when the session
 * is missing, invalid or expired, or the user was removed or signed out everywhere.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = await verifySession(token, getAuthEnv().AUTH_SECRET);
  if (!session) redirect("/admin/login");
  const user = await getSessionUser(session.sub, session.sv);
  if (!user) redirect("/admin/login");
  return { user, orgId: session.orgId };
});

/**
 * The seam for admin authorisation: the signed-in user plus the organisation they're
 * working in. Call it in every admin page AND every Server Action; proxy.ts is only an
 * early redirect, not the security boundary. A super admin without an organisation is
 * sent to the platform page.
 *
 * Admin-only by default: a scorer is sent to Results. Only the result screens and the result
 * action pass `{ allowScorer: true }` (and then check `role` for what a scorer may do).
 */
export async function getCurrentAdmin(options: { allowScorer?: boolean } = {}): Promise<CurrentAdmin> {
  const { user, orgId } = await getCurrentUser();
  const resolved = await resolveAdminOrg(user, orgId);
  if (!resolved) redirect(user.isSuperAdmin ? "/admin/platform" : "/admin/login");
  const role = resolved.org.role;
  if (role !== "admin" && !options.allowScorer) redirect("/admin/results");
  return { user, ...resolved, role };
}

/** For platform pages and actions: only super admins get a PlatformScope. */
export async function getCurrentSuperAdmin(): Promise<{ user: SessionUser; platform: PlatformScope }> {
  const { user } = await getCurrentUser();
  if (!user.isSuperAdmin) redirect("/admin");
  return { user, platform: unsafePlatformScope(user.id) };
}

/** Sign in (or re-sign after an org switch or password change). Server Actions only. */
export async function setSession(user: Pick<SessionUser, "id" | "sessionVersion">, orgId: string | null): Promise<void> {
  const token = await signSession({ sub: user.id, orgId, sv: user.sessionVersion }, getAuthEnv().AUTH_SECRET);
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions());
}
