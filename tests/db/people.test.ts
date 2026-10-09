import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hashPassword } from "@/lib/auth/password";
import type { Db } from "@/lib/db/client";
import type { OrgScope } from "@/lib/db/queries";
import { redeemLinkToken, resolveAdminOrg } from "@/lib/db/queries/accounts";
import { adminScopeForOrg } from "@/lib/db/queries/admin";
import { addScorer, listOrgPeople, removeScorer, scorerLink } from "@/lib/db/queries/people";
import { ensureSuperAdmin, inviteOrgAdmin, unsafePlatformScope } from "@/lib/db/queries/platform";
import { organisations } from "@/lib/db/schema";
import { seedAll } from "@/scripts/seed/index";
import { createTestDb } from "../helpers/pglite";

let db: Db;
let close: () => Promise<void>;
let bp: OrgScope;
let demo: OrgScope;
const now = new Date("2026-10-10T10:00:00Z");
/** The org admin making changes (created in beforeAll). */
const admin = { userId: "" };

async function scopeFor(slug: string) {
  const [org] = await db.select().from(organisations).where(eq(organisations.slug, slug));
  return (await adminScopeForOrg(org!.id, db))!.scope;
}

beforeAll(async () => {
  ({ db, close } = await createTestDb());
  await seedAll(db);
  bp = await scopeFor("batho-pele");
  demo = await scopeFor("demo");
  const { userId: superId } = await ensureSuperAdmin({ email: "owner@example.com", name: "Owner" }, db);
  const bpAdmin = await inviteOrgAdmin(unsafePlatformScope(superId), bp.id, { name: "BP Admin", email: "bp-admin@example.com" }, now, db);
  admin.userId = bpAdmin!.userId;
});
afterAll(async () => {
  await close();
});

describe("organisation admins managing scorers", () => {
  it("adds a new scorer with an invite link, who can then sign in as a scorer", async () => {
    const result = await addScorer(bp, { name: "Kabelo", email: "Kabelo@Example.com" }, admin, now, db);
    expect(result.kind).toBe("link");
    const user = await redeemLinkToken((result as { token: string }).token, await hashPassword("corner flag blue"), now, db);
    expect((await resolveAdminOrg({ id: user!.id, isSuperAdmin: false }, bp.id, db))?.org.role).toBe("scorer");
    const kabelo = (await listOrgPeople(bp, db)).find((p) => p.email === "kabelo@example.com");
    expect(kabelo).toMatchObject({ role: "scorer", status: "active", manageable: true });
    // A reset link is allowed for a scorer who belongs only to this organisation.
    expect((await scorerLink(bp, kabelo!.userId, admin, now, db))?.purpose).toBe("reset");
  });

  it("never lets an org admin take over an account used in another organisation", async () => {
    const { userId: superId } = await ensureSuperAdmin({ email: "owner@example.com", name: "Owner" }, db);
    const platform = unsafePlatformScope(superId);
    // Naledi is invited as an admin of Demo but hasn't set a password yet.
    await inviteOrgAdmin(platform, demo.id, { name: "Naledi", email: "naledi@example.com" }, now, db);

    const added = await addScorer(bp, { name: "Naledi", email: "naledi@example.com" }, admin, now, db);
    expect(added.kind).toBe("pending-elsewhere");
    const naledi = (await listOrgPeople(bp, db)).find((p) => p.email === "naledi@example.com")!;
    expect(naledi.manageable).toBe(false);
    expect(await scorerLink(bp, naledi.userId, admin, now, db)).toBeNull();
    // The super admin's account can't be targeted either.
    await addScorer(bp, { name: "Owner", email: "owner@example.com" }, admin, now, db);
    const owner = (await listOrgPeople(bp, db)).find((p) => p.email === "owner@example.com")!;
    expect(owner.manageable).toBe(false);
    expect(await scorerLink(bp, owner.userId, admin, now, db)).toBeNull();

    // Removing Naledi as a scorer here leaves her Demo access alone.
    expect(await removeScorer(bp, naledi.userId, db)).toBe(true);
    expect((await listOrgPeople(demo, db)).some((p) => p.email === "naledi@example.com")).toBe(true);
  });

  it("doesn't change or remove organisation admins", async () => {
    const { userId: superId } = await ensureSuperAdmin({ email: "owner@example.com", name: "Owner" }, db);
    const invite = await inviteOrgAdmin(unsafePlatformScope(superId), bp.id, { name: "Lerato", email: "lerato@example.com" }, now, db);
    expect(await addScorer(bp, { name: "Lerato", email: "lerato@example.com" }, admin, now, db)).toEqual({
      kind: "already-admin",
      name: "Lerato",
    });
    expect(await removeScorer(bp, invite!.userId, db)).toBe(false);
    expect((await listOrgPeople(bp, db)).find((p) => p.userId === invite!.userId)?.role).toBe("org_admin");
  });

  it("can't manage another organisation's scorers", async () => {
    const kabelo = (await listOrgPeople(bp, db)).find((p) => p.email === "kabelo@example.com")!;
    expect(await scorerLink(demo, kabelo.userId, admin, now, db)).toBeNull();
    expect(await removeScorer(demo, kabelo.userId, db)).toBe(false);
  });
});
