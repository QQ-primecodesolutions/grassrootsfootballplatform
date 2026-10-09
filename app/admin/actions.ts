"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentAdmin, getCurrentUser, setSession } from "@/lib/auth";
import { clientIp, lockoutMessage, lockoutState } from "@/lib/auth/lockout";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { passwordProblem } from "@/lib/auth/password-rules";
import { SESSION_COOKIE } from "@/lib/auth/session";
import {
  accessibleOrg,
  changePassword,
  clearLoginFailures,
  findUserForLogin,
  getPasswordHash,
  listAccessibleOrgs,
  peekLinkToken,
  recentLoginFailures,
  recordLogin,
  recordLoginFailure,
  redeemLinkToken,
} from "@/lib/db/queries/accounts";
import { getAuthEnv } from "@/lib/env";

export type LoginState = { error: string | null };
export type PasswordFormState = { ok: boolean; message: string | null };

const loginSchema = z.object({
  email: z.string().trim().min(1, "Enter your email address").max(200),
  password: z.string().min(1, "Enter your password").max(200),
  next: z.string().optional(),
});

/** Only allow redirects back into the admin area (no open redirects). */
function safeNext(next: string | undefined): string | null {
  return next && /^\/admin(\/[\w\-/]*)?(\?[\w\-=&%.]*)?$/.test(next) && !next.startsWith("/admin/set-password") ? next : null;
}

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") ?? undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Enter your email and password" };

  try {
    getAuthEnv();
  } catch (e) {
    // Missing or example AUTH_SECRET: say so instead of crashing the form.
    console.error("[admin] login unavailable:", e instanceof Error ? e.message : e);
    return { error: "Admin login isn't set up on this server: set AUTH_SECRET, then redeploy." };
  }

  const ip = clientIp(await headers());
  const now = new Date();
  const { ipFailures, globalFailures } = await recentLoginFailures(ip, now);
  const before = lockoutState(ipFailures, globalFailures, now);
  if (before.blocked) return { error: lockoutMessage(before) };

  const user = await findUserForLogin(parsed.data.email);
  const passwordOk = await verifyPassword(parsed.data.password, user?.passwordHash ?? null);
  if (!user || !passwordOk || user.disabledAt) {
    await recordLoginFailure(ip, now);
    const after = lockoutState([now, ...ipFailures], globalFailures + 1, now);
    if (after.blocked) return { error: lockoutMessage(after) };
    return {
      error:
        after.attemptsLeft <= 2
          ? `Wrong email or password. ${after.attemptsLeft} attempt${after.attemptsLeft === 1 ? "" : "s"} left before a short lockout.`
          : "Wrong email or password.",
    };
  }

  const orgs = await listAccessibleOrgs(user);
  if (!orgs.length && !user.isSuperAdmin) {
    return { error: "Your account isn't linked to an organisation yet. Ask the platform admin to add you." };
  }

  await Promise.all([clearLoginFailures(ip), recordLogin(user.id, now)]);
  await setSession(user, orgs[0]?.id ?? null);
  redirect(safeNext(parsed.data.next) ?? (orgs.length ? "/admin" : "/admin/platform"));
}

export async function logout(): Promise<void> {
  (await cookies()).delete({ name: SESSION_COOKIE, path: "/admin" });
  redirect("/admin/login");
}

/** Switch the organisation the user is working in (only to one they can access). */
export async function switchOrganisation(formData: FormData): Promise<void> {
  const { user } = await getCurrentAdmin({ allowScorer: true });
  const orgId = z.uuid().safeParse(formData.get("orgId"));
  if (!orgId.success) return;
  const target = await accessibleOrg(user, orgId.data);
  if (!target) return;
  await setSession(user, target.org.id);
  redirect("/admin");
}

const newPasswordSchema = z
  .object({
    password: z.string().max(200),
    confirm: z.string().max(200),
  })
  .refine((v) => v.password === v.confirm, { message: "The two passwords don't match", path: ["confirm"] });

/** Invite and reset links: choose a password, then sign in straight away. */
export async function setPasswordFromLink(_prev: PasswordFormState, formData: FormData): Promise<PasswordFormState> {
  const token = z.string().max(100).safeParse(formData.get("token"));
  const parsed = newPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!token.success) return { ok: false, message: "This link isn't valid." };
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the password" };

  try {
    getAuthEnv();
  } catch {
    // Check before using the link, so a misconfigured server never burns a one-time link.
    return { ok: false, message: "Admin login isn't set up on this server yet. Try again later." };
  }
  const now = new Date();
  const link = await peekLinkToken(token.data, now);
  if (!link) return { ok: false, message: "This link has expired or was already used. Ask the platform admin for a new one." };
  const problem = passwordProblem(parsed.data.password, link.email);
  if (problem) return { ok: false, message: problem };

  const user = await redeemLinkToken(token.data, await hashPassword(parsed.data.password), now);
  if (!user) return { ok: false, message: "This link has expired or was already used. Ask the platform admin for a new one." };

  const orgs = await listAccessibleOrgs(user);
  await recordLogin(user.id, now);
  await setSession(user, orgs[0]?.id ?? null);
  redirect(orgs.length ? "/admin" : user.isSuperAdmin ? "/admin/platform" : "/admin/account");
}

/** Change your own password. Other devices are signed out; this one stays signed in. */
export async function changeOwnPassword(_prev: PasswordFormState, formData: FormData): Promise<PasswordFormState> {
  const { user, orgId } = await getCurrentUser();
  const current = z.string().max(200).safeParse(formData.get("current"));
  const parsed = newPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!current.success || !parsed.success) {
    return { ok: false, message: parsed.error?.issues[0]?.message ?? "Check the form" };
  }
  if (!(await verifyPassword(current.data, await getPasswordHash(user.id)))) {
    return { ok: false, message: "Your current password isn't right." };
  }
  const problem = passwordProblem(parsed.data.password, user.email);
  if (problem) return { ok: false, message: problem };

  const sessionVersion = await changePassword(user.id, await hashPassword(parsed.data.password));
  if (sessionVersion === null) return { ok: false, message: "The password couldn't be changed." };
  await setSession({ id: user.id, sessionVersion }, orgId);
  return { ok: true, message: "Password changed. You've been signed out on other devices." };
}
