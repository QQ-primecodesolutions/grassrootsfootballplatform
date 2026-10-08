import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { getDb, type Db } from "@/lib/db/client";
import { authTokens, memberships, organisations, users } from "@/lib/db/schema";
import { LINK_LIFETIME_HOURS, newLinkToken, type LinkPurpose } from "@/lib/auth/tokens";
import {
  normaliseEmail,
  type OrganisationCreateInput,
  type OrganisationUpdateInput,
} from "@/lib/platform/organisation-input";

/*
 * Super admin (platform) operations: organisations and their admins.
 * Every function takes a PlatformScope, which only getCurrentSuperAdmin() hands out
 * (the same idea as OrgScope for tenant data).
 */

declare const platformScopeBrand: unique symbol;
export type PlatformScope = { readonly userId: string; readonly [platformScopeBrand]: true };

/** Internal: only lib/auth (after checking is_super_admin) and scripts may mint this. */
export function unsafePlatformScope(userId: string): PlatformScope {
  return { userId } as PlatformScope;
}

export type PlatformOrganisation = {
  id: string;
  slug: string;
  name: string;
  listed: boolean;
  adminCount: number;
};

export async function listOrganisationsForPlatform(_p: PlatformScope, db: Db = getDb()): Promise<PlatformOrganisation[]> {
  return db
    .select({
      id: organisations.id,
      slug: organisations.slug,
      name: organisations.name,
      listed: organisations.listed,
      adminCount: sql<number>`(select count(*)::int from memberships m where m.organisation_id = "organisations"."id")`,
    })
    .from(organisations)
    .orderBy(asc(organisations.name));
}

export type OrgMember = {
  userId: string;
  name: string;
  email: string;
  /** "invited" until they use their link and choose a password. */
  status: "active" | "invited";
  isSuperAdmin: boolean;
  lastLoginAt: Date | null;
};

export async function getOrganisationForPlatform(_p: PlatformScope, orgId: string, db: Db = getDb()) {
  if (!/^[0-9a-f-]{36}$/i.test(orgId)) return null;
  const [org] = await db.select().from(organisations).where(eq(organisations.id, orgId)).limit(1);
  if (!org) return null;
  const rows = await db
    .select({
      userId: users.id,
      name: users.name,
      email: users.email,
      passwordHash: users.passwordHash,
      isSuperAdmin: users.isSuperAdmin,
      lastLoginAt: users.lastLoginAt,
    })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(eq(memberships.organisationId, orgId))
    .orderBy(asc(users.name));
  const members: OrgMember[] = rows.map(({ passwordHash, ...m }) => ({ ...m, status: passwordHash ? "active" : "invited" }));
  return { org, members };
}

function brandValues(input: OrganisationUpdateInput) {
  return {
    name: input.name,
    shortName: input.shortName,
    tagline: input.tagline,
    primaryColor: input.primaryColor,
    secondaryColor: input.secondaryColor,
    logoUrl: input.logoUrl,
    hashtags: input.hashtags,
  };
}

/** New organisations start unlisted, so they don't appear on "/" until they're ready. */
export async function createOrganisation(
  _p: PlatformScope,
  input: OrganisationCreateInput,
  db: Db = getDb(),
): Promise<{ ok: true; id: string } | { ok: false; error: "slug-taken" }> {
  const [row] = await db
    .insert(organisations)
    .values({
      ...brandValues(input),
      slug: input.slug,
      socialLinks: input.facebook ? { facebook: input.facebook } : {},
      listed: false,
    })
    .onConflictDoNothing({ target: organisations.slug })
    .returning({ id: organisations.id });
  return row ? { ok: true, id: row.id } : { ok: false, error: "slug-taken" };
}

export async function updateOrganisation(
  _p: PlatformScope,
  orgId: string,
  input: OrganisationUpdateInput,
  db: Db = getDb(),
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select({ socialLinks: organisations.socialLinks })
      .from(organisations)
      .where(eq(organisations.id, orgId))
      .limit(1);
    if (!current) return false;
    const { facebook: _old, ...otherLinks } = current.socialLinks;
    await tx
      .update(organisations)
      .set({ ...brandValues(input), socialLinks: input.facebook ? { ...otherLinks, facebook: input.facebook } : otherLinks })
      .where(eq(organisations.id, orgId));
    return true;
  });
}

export async function setOrganisationListed(_p: PlatformScope, orgId: string, listed: boolean, db: Db = getDb()) {
  const rows = await db.update(organisations).set({ listed }).where(eq(organisations.id, orgId)).returning({ id: organisations.id });
  return rows.length > 0;
}

// ---------------------------------------------------------------------------
// Admins and links
// ---------------------------------------------------------------------------

/** Create a one-time link for a user; earlier unused links for them stop working. Returns the raw token. */
export async function issuePasswordLink(
  p: PlatformScope | null,
  userId: string,
  purpose: LinkPurpose,
  now: Date,
  db: Db = getDb(),
): Promise<string> {
  const { token, hash } = newLinkToken();
  await db.transaction(async (tx) => {
    await tx
      .update(authTokens)
      .set({ usedAt: now })
      .where(and(eq(authTokens.userId, userId), isNull(authTokens.usedAt)));
    await tx.insert(authTokens).values({
      tokenHash: hash,
      purpose,
      userId,
      createdBy: p?.userId ?? null,
      expiresAt: new Date(now.getTime() + LINK_LIFETIME_HOURS[purpose] * 60 * 60_000),
    });
  });
  return token;
}

export type InviteResult =
  /** A new or not-yet-activated account: send them this link. */
  | { kind: "link"; userId: string; token: string }
  /** They already have a password: they'll see this organisation next time they sign in. */
  | { kind: "added"; userId: string; name: string };

/** Add an organisation admin by email, creating the account if needed. */
export async function inviteOrgAdmin(
  p: PlatformScope,
  orgId: string,
  input: { name: string; email: string },
  now: Date,
  db: Db = getDb(),
): Promise<InviteResult | null> {
  const email = normaliseEmail(input.email);
  const result = await db.transaction(async (tx) => {
    const [org] = await tx.select({ id: organisations.id }).from(organisations).where(eq(organisations.id, orgId)).limit(1);
    if (!org) return null;
    await tx.insert(users).values({ email, name: input.name }).onConflictDoNothing({ target: users.email });
    const [user] = await tx
      .select({ id: users.id, name: users.name, passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    await tx.insert(memberships).values({ userId: user!.id, organisationId: orgId }).onConflictDoNothing();
    return user!;
  });
  if (!result) return null;
  if (result.passwordHash) return { kind: "added", userId: result.id, name: result.name };
  return { kind: "link", userId: result.id, token: await issuePasswordLink(p, result.id, "invite", now, db) };
}

/** Is this user a member of this organisation (for actions on a member)? */
export async function getOrgMember(_p: PlatformScope, orgId: string, userId: string, db: Db = getDb()) {
  const [row] = await db
    .select({ userId: users.id, passwordHash: users.passwordHash })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(and(eq(memberships.organisationId, orgId), eq(memberships.userId, userId)))
    .limit(1);
  return row ? { userId: row.userId, active: row.passwordHash !== null } : null;
}

/** Remove someone's access to one organisation, and sign them out everywhere. */
export async function removeOrgAdmin(_p: PlatformScope, orgId: string, userId: string, db: Db = getDb()): Promise<boolean> {
  return db.transaction(async (tx) => {
    const removed = await tx
      .delete(memberships)
      .where(and(eq(memberships.organisationId, orgId), eq(memberships.userId, userId)))
      .returning({ userId: memberships.userId });
    if (!removed.length) return false;
    await tx
      .update(users)
      .set({ sessionVersion: sql`${users.sessionVersion} + 1` })
      .where(eq(users.id, userId));
    return true;
  });
}

export async function listSuperAdmins(_p: PlatformScope, db: Db = getDb()) {
  return db
    .select({ id: users.id, name: users.name, email: users.email, lastLoginAt: users.lastLoginAt })
    .from(users)
    .where(eq(users.isSuperAdmin, true))
    .orderBy(asc(users.name));
}

/**
 * For `pnpm admin:super` only: create or promote a super admin. Returns whether they
 * already have a password (then they get a reset link, else an invite link).
 */
export async function ensureSuperAdmin(input: { email: string; name: string }, db: Db) {
  const email = normaliseEmail(input.email);
  const [row] = await db
    .insert(users)
    .values({ email, name: input.name, isSuperAdmin: true })
    .onConflictDoUpdate({ target: users.email, set: { isSuperAdmin: true, disabledAt: null } })
    .returning({ id: users.id, passwordHash: users.passwordHash });
  return { userId: row!.id, hasPassword: row!.passwordHash !== null };
}
