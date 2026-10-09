import { and, asc, eq, sql } from "drizzle-orm";
import { getDb, type Db } from "@/lib/db/client";
import { memberships, users } from "@/lib/db/schema";
import { normaliseEmail } from "@/lib/platform/organisation-input";
import type { OrgScope } from "./organisations";
import { issuePasswordLink } from "./platform";

/*
 * An organisation admin managing their own scorers (the super admin manages everyone on the
 * Platform page). Safety rule: an org admin may only send invite/reset links to, or remove,
 * a scorer whose ONLY membership is this organisation and who isn't a super admin. Otherwise
 * an admin of one organisation could take over an account used in another.
 */

export type OrgPerson = {
  userId: string;
  name: string;
  email: string;
  role: "org_admin" | "scorer";
  status: "active" | "invited";
  lastLoginAt: Date | null;
  /** This org admin may send links to / remove this person. */
  manageable: boolean;
};

export async function listOrgPeople(scope: OrgScope, db: Db = getDb()): Promise<OrgPerson[]> {
  const rows = await db
    .select({
      userId: users.id,
      name: users.name,
      email: users.email,
      role: memberships.role,
      passwordHash: users.passwordHash,
      lastLoginAt: users.lastLoginAt,
      isSuperAdmin: users.isSuperAdmin,
      otherOrgs: sql<number>`(select count(*)::int from memberships o where o.user_id = "users"."id" and o.organisation_id <> ${scope.id})`,
    })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(eq(memberships.organisationId, scope.id))
    .orderBy(asc(memberships.role), asc(users.name));
  return rows.map(({ passwordHash, isSuperAdmin, otherOrgs, ...p }) => ({
    ...p,
    status: passwordHash ? "active" : "invited",
    manageable: p.role === "scorer" && !isSuperAdmin && otherOrgs === 0,
  }));
}

async function manageableScorer(scope: OrgScope, userId: string, db: Db) {
  const person = (await listOrgPeople(scope, db)).find((p) => p.userId === userId);
  return person?.manageable ? person : null;
}

export type AddScorerResult =
  | { kind: "link"; userId: string; token: string }
  /** They already have a password: they'll see this organisation when they sign in. */
  | { kind: "added"; name: string }
  /** Already an admin here: not changed. */
  | { kind: "already-admin"; name: string }
  /** Invited elsewhere and not set up yet: they must use that invite first. */
  | { kind: "pending-elsewhere"; name: string };

/** Add a scorer to this organisation by email, creating the account if needed. */
export async function addScorer(
  scope: OrgScope,
  input: { name: string; email: string },
  createdBy: { userId: string },
  now: Date,
  db: Db = getDb(),
): Promise<AddScorerResult> {
  const email = normaliseEmail(input.email);
  const outcome = await db.transaction(async (tx) => {
    await tx.insert(users).values({ email, name: input.name }).onConflictDoNothing({ target: users.email });
    const [user] = await tx
      .select({ id: users.id, name: users.name, passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    const [existing] = await tx
      .select({ role: memberships.role })
      .from(memberships)
      .where(and(eq(memberships.userId, user!.id), eq(memberships.organisationId, scope.id)))
      .limit(1);
    if (existing?.role === "org_admin") return { user: user!, alreadyAdmin: true };
    await tx
      .insert(memberships)
      .values({ userId: user!.id, organisationId: scope.id, role: "scorer" })
      .onConflictDoNothing({ target: [memberships.userId, memberships.organisationId] });
    return { user: user!, alreadyAdmin: false };
  });
  const { user } = outcome;
  if (outcome.alreadyAdmin) return { kind: "already-admin", name: user.name };
  if (user.passwordHash) return { kind: "added", name: user.name };
  if (!(await manageableScorer(scope, user.id, db))) return { kind: "pending-elsewhere", name: user.name };
  return { kind: "link", userId: user.id, token: await issuePasswordLink(createdBy, user.id, "invite", now, db) };
}

/** A new invite link (not yet set up) or a password reset link, for a scorer this admin manages. */
export async function scorerLink(
  scope: OrgScope,
  userId: string,
  createdBy: { userId: string },
  now: Date,
  db: Db = getDb(),
): Promise<{ token: string; purpose: "invite" | "reset"; name: string } | null> {
  const person = await manageableScorer(scope, userId, db);
  if (!person) return null;
  const purpose = person.status === "active" ? "reset" : "invite";
  return { token: await issuePasswordLink(createdBy, userId, purpose, now, db), purpose, name: person.name };
}

/** Remove a scorer from this organisation (never an admin). */
export async function removeScorer(scope: OrgScope, userId: string, db: Db = getDb()): Promise<boolean> {
  const rows = await db
    .delete(memberships)
    .where(and(eq(memberships.organisationId, scope.id), eq(memberships.userId, userId), eq(memberships.role, "scorer")))
    .returning({ userId: memberships.userId });
  // Their other memberships (if any) are untouched; access is checked on every request.
  return rows.length > 0;
}
