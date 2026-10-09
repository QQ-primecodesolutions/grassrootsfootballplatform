import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import type { Db } from "@/lib/db/client";
import {
  accessibleOrg,
  changePassword,
  clearLoginFailures,
  findUserForLogin,
  getSessionUser,
  listAccessibleOrgs,
  peekLinkToken,
  recentLoginFailures,
  recordLoginFailure,
  resolveAdminOrg,
  redeemLinkToken,
} from "@/lib/db/queries/accounts";
import {
  createOrganisation,
  ensureSuperAdmin,
  getOrganisationForPlatform,
  inviteOrgAdmin,
  issuePasswordLink,
  listOrganisationsForPlatform,
  removeOrgAdmin,
  setMemberRole,
  setOrganisationListed,
  unsafePlatformScope,
  updateOrganisation,
} from "@/lib/db/queries/platform";
import { getAdminMatch, saveMatchResult } from "@/lib/db/queries/admin";
import { authTokens, matches, organisations, users } from "@/lib/db/schema";
import { organisationCreateSchema } from "@/lib/platform/organisation-input";
import { seedAll } from "@/scripts/seed/index";
import { createTestDb } from "../helpers/pglite";

let db: Db;
let close: () => Promise<void>;
let bpId: string;
let demoId: string;
const now = new Date("2026-10-08T10:00:00Z");
const later = (hours: number) => new Date(now.getTime() + hours * 3_600_000);

beforeAll(async () => {
  ({ db, close } = await createTestDb());
  await seedAll(db);
  const orgs = await db.select({ id: organisations.id, slug: organisations.slug }).from(organisations);
  bpId = orgs.find((o) => o.slug === "batho-pele")!.id;
  demoId = orgs.find((o) => o.slug === "demo")!.id;
});
afterAll(async () => {
  await close();
});

async function superAdmin() {
  const { userId } = await ensureSuperAdmin({ email: "Owner@Example.com", name: "Owner" }, db);
  return { platform: unsafePlatformScope(userId), userId };
}

describe("super admin bootstrap", () => {
  it("creates a super admin without a password, then promotes idempotently", async () => {
    const first = await ensureSuperAdmin({ email: " Owner@Example.com ", name: "Owner" }, db);
    expect(first.hasPassword).toBe(false);
    const again = await ensureSuperAdmin({ email: "owner@example.com", name: "Owner" }, db);
    expect(again.userId).toBe(first.userId);
    const [row] = await db.select().from(users).where(eq(users.id, first.userId));
    expect(row).toMatchObject({ email: "owner@example.com", isSuperAdmin: true, passwordHash: null });
  });

  it("can't sign in before choosing a password", async () => {
    const u = await findUserForLogin("owner@example.com", db);
    expect(await verifyPassword("anything at all", u!.passwordHash)).toBe(false);
  });

  it("sees every organisation", async () => {
    const { userId } = await superAdmin();
    const orgs = await listAccessibleOrgs({ id: userId, isSuperAdmin: true }, db);
    expect(orgs.map((o) => o.id).sort()).toEqual([bpId, demoId].sort());
  });
});

describe("invite links", () => {
  it("work once, set the password, and sign out older sessions", async () => {
    const { platform } = await superAdmin();
    const invite = await inviteOrgAdmin(platform, bpId, { name: "Lerato", email: "Lerato@club.co.za" }, now, db);
    expect(invite?.kind).toBe("link");
    const token = (invite as { token: string }).token;

    expect(await peekLinkToken(token, now, db)).toEqual({ purpose: "invite", email: "lerato@club.co.za", name: "Lerato" });
    const stored = await db.select({ tokenHash: authTokens.tokenHash }).from(authTokens);
    expect(stored.some((t) => t.tokenHash === token)).toBe(false);

    const user = await redeemLinkToken(token, await hashPassword("blue kettle river song"), now, db);
    expect(user).toMatchObject({ email: "lerato@club.co.za", sessionVersion: 2, isSuperAdmin: false });
    expect(await getSessionUser(user!.id, 1, db)).toBeNull();
    expect(await getSessionUser(user!.id, 2, db)).not.toBeNull();

    // A second use fails.
    expect(await peekLinkToken(token, now, db)).toBeNull();
    expect(await redeemLinkToken(token, await hashPassword("other password here"), now, db)).toBeNull();
    const login = await findUserForLogin("LERATO@club.co.za", db);
    expect(await verifyPassword("blue kettle river song", login!.passwordHash)).toBe(true);
  });

  it("expire, and a new link replaces the old one", async () => {
    const { platform } = await superAdmin();
    const invite = await inviteOrgAdmin(platform, demoId, { name: "Sipho", email: "sipho@example.com" }, now, db);
    const first = (invite as { token: string; userId: string }).token;
    expect(await peekLinkToken(first, later(7 * 24 + 1), db)).toBeNull();

    const second = await issuePasswordLink(platform, invite!.userId, "invite", now, db);
    expect(await peekLinkToken(first, now, db)).toBeNull();
    expect(await peekLinkToken(second, now, db)).not.toBeNull();
  });

  it("adds an existing account to another organisation without a link", async () => {
    const { platform } = await superAdmin();
    const again = await inviteOrgAdmin(platform, demoId, { name: "L", email: "lerato@club.co.za" }, now, db);
    expect(again).toMatchObject({ kind: "added", name: "Lerato" });
  });

  it("returns null for an unknown organisation", async () => {
    const { platform } = await superAdmin();
    expect(await inviteOrgAdmin(platform, "00000000-0000-4000-8000-000000000000", { name: "X", email: "x@y.co" }, now, db)).toBeNull();
  });
});

describe("organisation access", () => {
  it("limits an org admin to their organisations, and falls back when the session's org is gone", async () => {
    const { platform } = await superAdmin();
    const invite = await inviteOrgAdmin(platform, bpId, { name: "Thabo", email: "thabo@example.com" }, now, db);
    const thabo = await redeemLinkToken((invite as { token: string }).token, await hashPassword("a long passphrase"), now, db);
    const who = { id: thabo!.id, isSuperAdmin: false };

    expect((await listAccessibleOrgs(who, db)).map((o) => o.id)).toEqual([bpId]);
    expect(await accessibleOrg(who, bpId, db)).not.toBeNull();
    expect(await accessibleOrg(who, demoId, db)).toBeNull();
    expect((await resolveAdminOrg(who, demoId, db))?.org.id).toBe(bpId);

    // Removal: no access, and existing sessions stop working.
    expect(await removeOrgAdmin(platform, bpId, thabo!.id, db)).toBe(true);
    expect(await resolveAdminOrg(who, bpId, db)).toBeNull();
    expect(await getSessionUser(thabo!.id, thabo!.sessionVersion, db)).toBeNull();
  });

  it("changing a password signs out other sessions", async () => {
    const u = await findUserForLogin("lerato@club.co.za", db);
    const sv = await changePassword(u!.id, await hashPassword("new long passphrase"), db);
    expect(sv).toBe(u!.sessionVersion + 1);
    expect(await getSessionUser(u!.id, u!.sessionVersion, db)).toBeNull();
  });
});

describe("organisations", () => {
  const input = organisationCreateSchema.parse({
    name: "Maluti Winter Cup",
    slug: "maluti-cup",
    shortName: "Maluti Cup",
    tagline: "",
    primaryColor: "#123456",
    secondaryColor: "#ABCDEF",
    logoUrl: "",
    facebook: "",
    hashtags: "#Maluti",
  });

  it("creates an unlisted organisation and refuses a taken link name", async () => {
    const { platform } = await superAdmin();
    const created = await createOrganisation(platform, input, db);
    expect(created.ok).toBe(true);
    const id = (created as { id: string }).id;
    const data = await getOrganisationForPlatform(platform, id, db);
    expect(data?.org).toMatchObject({ slug: "maluti-cup", listed: false, hashtags: ["#Maluti"], socialLinks: {} });
    expect(await createOrganisation(platform, input, db)).toEqual({ ok: false, error: "slug-taken" });
    expect(await createOrganisation(platform, { ...input, slug: "batho-pele" }, db)).toEqual({ ok: false, error: "slug-taken" });

    expect(await setOrganisationListed(platform, id, true, db)).toBe(true);
    const listed = await listOrganisationsForPlatform(platform, db);
    expect(listed.find((o) => o.id === id)).toMatchObject({ listed: true, adminCount: 0 });
    // Regression: the count is per organisation (Lerato is an admin of Batho Pele).
    expect(listed.find((o) => o.id === bpId)).toMatchObject({ adminCount: 1 });
  });

  it("updates branding and keeps other social links", async () => {
    const { platform } = await superAdmin();
    await db.update(organisations).set({ socialLinks: { facebook: "https://www.facebook.com/a", website: "https://a.example" } }).where(eq(organisations.slug, "maluti-cup"));
    const [org] = await db.select().from(organisations).where(eq(organisations.slug, "maluti-cup"));
    const { slug: _slug, ...update } = input;
    expect(await updateOrganisation(platform, org!.id, { ...update, name: "Maluti Cup 2026", facebook: null }, db)).toBe(true);
    const [after] = await db.select().from(organisations).where(eq(organisations.id, org!.id));
    expect(after).toMatchObject({ name: "Maluti Cup 2026", slug: "maluti-cup", socialLinks: { website: "https://a.example" } });
  });
});

describe("login failures", () => {
  it("are counted per IP within the window and cleared on success", async () => {
    for (let i = 0; i < 3; i++) await recordLoginFailure("41.0.0.1", new Date(now.getTime() + i * 1000), db);
    await recordLoginFailure("41.0.0.2", now, db);
    const at = later(0.01);
    const a = await recentLoginFailures("41.0.0.1", at, db);
    expect(a.ipFailures).toHaveLength(3);
    expect(a.ipFailures[0]!.getTime()).toBeGreaterThan(a.ipFailures[2]!.getTime());
    expect(a.globalFailures).toBe(4);
    expect((await recentLoginFailures("41.0.0.1", later(1), db)).ipFailures).toHaveLength(0);

    await clearLoginFailures("41.0.0.1", db);
    expect((await recentLoginFailures("41.0.0.1", at, db)).ipFailures).toHaveLength(0);
    expect((await recentLoginFailures("41.0.0.2", at, db)).ipFailures).toHaveLength(1);
  });
});

describe("scorers", () => {
  it("get the scorer role in their organisation, can be promoted, and saves record who entered", async () => {
    const { platform } = await superAdmin();
    const invite = await inviteOrgAdmin(platform, bpId, { name: "Scorer Sam", email: "sam@example.com", role: "scorer" }, now, db);
    const sam = await redeemLinkToken((invite as { token: string }).token, await hashPassword("goal line camera"), now, db);
    const who = { id: sam!.id, isSuperAdmin: false };
    expect((await resolveAdminOrg(who, bpId, db))?.org.role).toBe("scorer");
    const data = await getOrganisationForPlatform(platform, bpId, db);
    expect(data?.members.find((m) => m.userId === sam!.id)).toMatchObject({ role: "scorer", status: "active" });

    const [match] = await db.select().from(matches).where(eq(matches.organisationId, bpId)).limit(1);
    const scope = (await resolveAdminOrg(who, bpId, db))!.scope;
    await saveMatchResult(
      scope,
      match!.id,
      {
        status: "completed",
        outcomeType: "normal",
        resultState: "provisional",
        homeGoals: 1,
        awayGoals: 0,
        htHomeGoals: null,
        htAwayGoals: null,
        aetHomeGoals: null,
        aetAwayGoals: null,
        penHome: null,
        penAway: null,
        winnerEntryId: match!.homeEntryId,
        confirmedAt: null,
        notes: null,
        resultEnteredBy: sam!.id,
      },
      db,
    );
    expect((await getAdminMatch(scope, match!.id, db))?.enteredByName).toBe("Scorer Sam");

    expect(await setMemberRole(platform, bpId, sam!.id, "org_admin", db)).toBe(true);
    expect((await resolveAdminOrg(who, bpId, db))?.org.role).toBe("admin");
    // Inviting an existing member again sets the role given.
    await inviteOrgAdmin(platform, bpId, { name: "Scorer Sam", email: "sam@example.com", role: "scorer" }, now, db);
    expect((await resolveAdminOrg(who, bpId, db))?.org.role).toBe("scorer");
  });
});
