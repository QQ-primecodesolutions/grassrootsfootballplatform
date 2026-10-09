import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/lib/db/client";
import type { OrgScope } from "@/lib/db/queries";
import { adminScopeForOrg } from "@/lib/db/queries/admin";
import { getMedia, saveMedia } from "@/lib/db/queries/media";
import { media, organisations } from "@/lib/db/schema";
import { MAX_MEDIA_BYTES, parseMediaPath } from "@/lib/media/image";
import { seedAll } from "@/scripts/seed/index";
import { createTestDb } from "../helpers/pglite";

let db: Db;
let close: () => Promise<void>;
let bp: OrgScope;
let demo: OrgScope;

async function scopeFor(slug: string) {
  const [org] = await db.select().from(organisations).where(eq(organisations.slug, slug));
  return (await adminScopeForOrg(org!.id, db))!.scope;
}

const png = (marker: number) => new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, marker, 1, 2, 3]);

beforeAll(async () => {
  ({ db, close } = await createTestDb());
  await seedAll(db);
  bp = await scopeFor("batho-pele");
  demo = await scopeFor("demo");
});
afterAll(async () => {
  await close();
});

describe("media storage", () => {
  it("stores an image once per organisation and serves it back", async () => {
    const first = await saveMedia(bp, png(1), db);
    expect(first.ok).toBe(true);
    const path = (first as { path: string }).path;
    expect(parseMediaPath(path)).toMatchObject({ orgSlug: "batho-pele", ext: "png" });

    const again = await saveMedia(bp, png(1), db);
    expect((again as { id: string }).id).toBe((first as { id: string }).id);
    expect(await db.select({ id: media.id }).from(media)).toHaveLength(1);

    const found = await getMedia(bp, (first as { id: string }).id, db);
    expect(found?.contentType).toBe("image/png");
    expect([...found!.bytes]).toEqual([...png(1)]);
  });

  it("keeps each organisation's images separate", async () => {
    const saved = (await saveMedia(bp, png(2), db)) as { id: string };
    expect(await getMedia(demo, saved.id, db)).toBeNull();
    // The same file uploaded by another organisation is its own row.
    const theirs = (await saveMedia(demo, png(2), db)) as { id: string };
    expect(theirs.id).not.toBe(saved.id);
  });

  it("refuses files that aren't PNG/JPEG, empty files and oversized files", async () => {
    expect(await saveMedia(bp, new TextEncoder().encode("<svg/>"), db)).toEqual({ ok: false, error: "not-an-image" });
    expect(await saveMedia(bp, new Uint8Array(), db)).toEqual({ ok: false, error: "empty" });
    const big = new Uint8Array(MAX_MEDIA_BYTES + 1);
    big.set(png(3));
    expect(await saveMedia(bp, big, db)).toEqual({ ok: false, error: "too-large" });
  });
});
