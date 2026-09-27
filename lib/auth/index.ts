import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminScopeForOrg } from "@/lib/db/queries/admin";
import type { OrgScope } from "@/lib/db/queries";
import { getAuthEnv } from "@/lib/env";
import { SESSION_COOKIE, verifySession } from "./session";

export type CurrentAdmin = {
  scope: OrgScope;
  org: { id: string; slug: string; name: string; hashtags: string[] };
};

/**
 * The seam for admin authentication (prototype: one shared password).
 * Call it in every admin page AND every Server Action; proxy.ts is only an early
 * redirect, not the security boundary. Redirects to the login page when the
 * session is missing, invalid, expired or points at a deleted organisation.
 * Real users and roles can replace this later without touching callers.
 */
export async function getCurrentAdmin(): Promise<CurrentAdmin> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = await verifySession(token, getAuthEnv().AUTH_SECRET);
  if (!session) redirect("/admin/login");
  const resolved = await adminScopeForOrg(session.orgId);
  if (!resolved) redirect("/admin/login");
  return resolved;
}
