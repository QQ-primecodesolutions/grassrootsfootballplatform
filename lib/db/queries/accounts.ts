import { and, asc, desc, eq, gt, isNull, lt, sql } from "drizzle-orm";
import { getDb, type Db } from "@/lib/db/client";
import { authTokens, loginFailures, memberships, organisations, users } from "@/lib/db/schema";
import { windowStart, LOCKOUT } from "@/lib/auth/lockout";
import { hashLinkToken, isLinkTokenShape, type LinkPurpose } from "@/lib/auth/tokens";
import { normaliseEmail } from "@/lib/platform/organisation-input";
import { unsafeOrgScope, type OrgScope } from "./organisations";

/*
 * Admin accounts: sign-in, sessions, one-time links and the login lockout.
 * Only lib/auth and the admin auth actions call these. Organisation access is
 * decided here: a super admin can work in every organisation, everyone else only
 * in the organisations they are a member of.
 */

export type SessionUser = { id: string; email: string; name: string; isSuperAdmin: boolean; sessionVersion: number };
export type AdminOrg = { id: string; slug: string; name: string; hashtags: string[] };

const sessionUserColumns = {
  id: users.id,
  email: users.email,
  name: users.name,
  isSuperAdmin: users.isSuperAdmin,
  sessionVersion: users.sessionVersion,
};

/** The user behind a session, or null if they were removed, disabled or signed out everywhere. */
export async function getSessionUser(userId: string, sessionVersion: number, db: Db = getDb()): Promise<SessionUser | null> {
  const [user] = await db
    .select(sessionUserColumns)
    .from(users)
    .where(and(eq(users.id, userId), eq(users.sessionVersion, sessionVersion), isNull(users.disabledAt)))
    .limit(1);
  return user ?? null;
}

const orgColumns = { id: organisations.id, slug: organisations.slug, name: organisations.name, hashtags: organisations.hashtags };

export async function listAccessibleOrgs(user: Pick<SessionUser, "id" | "isSuperAdmin">, db: Db = getDb()): Promise<AdminOrg[]> {
  if (user.isSuperAdmin) return db.select(orgColumns).from(organisations).orderBy(asc(organisations.name));
  return db
    .select(orgColumns)
    .from(memberships)
    .innerJoin(organisations, eq(organisations.id, memberships.organisationId))
    .where(eq(memberships.userId, user.id))
    .orderBy(asc(organisations.name));
}

/** The org scope for `orgId` if this user may work in it, otherwise null. */
export async function accessibleOrg(
  user: Pick<SessionUser, "id" | "isSuperAdmin">,
  orgId: string,
  db: Db = getDb(),
): Promise<{ scope: OrgScope; org: AdminOrg } | null> {
  if (!/^[0-9a-f-]{36}$/i.test(orgId)) return null;
  const rows = user.isSuperAdmin
    ? await db.select(orgColumns).from(organisations).where(eq(organisations.id, orgId)).limit(1)
    : await db
        .select(orgColumns)
        .from(memberships)
        .innerJoin(organisations, eq(organisations.id, memberships.organisationId))
        .where(and(eq(memberships.userId, user.id), eq(memberships.organisationId, orgId)))
        .limit(1);
  const org = rows[0];
  return org ? { scope: unsafeOrgScope(org.id, org.slug), org } : null;
}

/** The session's organisation if still accessible, else the user's first one, else null. */
export async function resolveAdminOrg(
  user: Pick<SessionUser, "id" | "isSuperAdmin">,
  orgId: string | null,
  db: Db = getDb(),
): Promise<{ scope: OrgScope; org: AdminOrg } | null> {
  const current = orgId ? await accessibleOrg(user, orgId, db) : null;
  if (current) return current;
  const [first] = await listAccessibleOrgs(user, db);
  return first ? { scope: unsafeOrgScope(first.id, first.slug), org: first } : null;
}

// ---------------------------------------------------------------------------
// Sign-in and lockout
// ---------------------------------------------------------------------------

export async function findUserForLogin(email: string, db: Db = getDb()) {
  const [user] = await db
    .select({ ...sessionUserColumns, passwordHash: users.passwordHash, disabledAt: users.disabledAt })
    .from(users)
    .where(eq(users.email, normaliseEmail(email)))
    .limit(1);
  return user ?? null;
}

/** This IP's latest failures (newest first) and the count from all IPs, within the lockout window. */
export async function recentLoginFailures(ip: string, now: Date, db: Db = getDb()) {
  const since = windowStart(now);
  const [ipRows, [global]] = await Promise.all([
    db
      .select({ createdAt: loginFailures.createdAt })
      .from(loginFailures)
      .where(and(eq(loginFailures.ip, ip), gt(loginFailures.createdAt, since)))
      .orderBy(desc(loginFailures.createdAt))
      .limit(LOCKOUT.perIp),
    db.select({ n: sql<number>`count(*)::int` }).from(loginFailures).where(gt(loginFailures.createdAt, since)),
  ]);
  return { ipFailures: ipRows.map((r) => r.createdAt), globalFailures: global?.n ?? 0 };
}

export async function recordLoginFailure(ip: string, now: Date, db: Db = getDb()): Promise<void> {
  await db.insert(loginFailures).values({ ip, createdAt: now });
  // Keep the table small: nothing older than a day is ever needed.
  await db.delete(loginFailures).where(lt(loginFailures.createdAt, new Date(now.getTime() - 24 * 60 * 60_000)));
}

export async function clearLoginFailures(ip: string, db: Db = getDb()): Promise<void> {
  await db.delete(loginFailures).where(eq(loginFailures.ip, ip));
}

export async function recordLogin(userId: string, now: Date, db: Db = getDb()): Promise<void> {
  await db.update(users).set({ lastLoginAt: now }).where(eq(users.id, userId));
}

// ---------------------------------------------------------------------------
// One-time links and passwords
// ---------------------------------------------------------------------------

/** What the set-password page shows for a link, or null if it's unknown, used or expired. */
export async function peekLinkToken(
  token: string,
  now: Date,
  db: Db = getDb(),
): Promise<{ purpose: LinkPurpose; email: string; name: string } | null> {
  if (!isLinkTokenShape(token)) return null;
  const [row] = await db
    .select({ purpose: authTokens.purpose, email: users.email, name: users.name })
    .from(authTokens)
    .innerJoin(users, eq(users.id, authTokens.userId))
    .where(
      and(
        eq(authTokens.tokenHash, hashLinkToken(token)),
        isNull(authTokens.usedAt),
        gt(authTokens.expiresAt, now),
        isNull(users.disabledAt),
      ),
    )
    .limit(1);
  return row ?? null;
}

/**
 * Use a link once: sets the password and signs the user out everywhere else.
 * The conditional UPDATE makes a second use (or a race) fail.
 */
export async function redeemLinkToken(token: string, passwordHash: string, now: Date, db: Db = getDb()) {
  if (!isLinkTokenShape(token)) return null;
  return db.transaction(async (tx) => {
    const [used] = await tx
      .update(authTokens)
      .set({ usedAt: now })
      .where(and(eq(authTokens.tokenHash, hashLinkToken(token)), isNull(authTokens.usedAt), gt(authTokens.expiresAt, now)))
      .returning({ userId: authTokens.userId });
    if (!used) return null;
    // Any other open links for this user stop working too.
    await tx
      .update(authTokens)
      .set({ usedAt: now })
      .where(and(eq(authTokens.userId, used.userId), isNull(authTokens.usedAt)));
    const [user] = await tx
      .update(users)
      .set({ passwordHash, sessionVersion: sql`${users.sessionVersion} + 1` })
      .where(and(eq(users.id, used.userId), isNull(users.disabledAt)))
      .returning(sessionUserColumns);
    return user ?? null;
  });
}

export async function getPasswordHash(userId: string, db: Db = getDb()): Promise<string | null> {
  const [row] = await db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, userId)).limit(1);
  return row?.passwordHash ?? null;
}

/** Change a password and sign out every other session. Returns the new session version. */
export async function changePassword(userId: string, passwordHash: string, db: Db = getDb()): Promise<number | null> {
  const [row] = await db
    .update(users)
    .set({ passwordHash, sessionVersion: sql`${users.sessionVersion} + 1` })
    .where(eq(users.id, userId))
    .returning({ sessionVersion: users.sessionVersion });
  return row?.sessionVersion ?? null;
}
