import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { getDb, type Db } from "@/lib/db/client";
import { media } from "@/lib/db/schema";
import { MAX_MEDIA_BYTES, mediaPath, sniffImageType, type MediaType } from "@/lib/media/image";
import { resolveOrgBySlug, type OrgScope } from "./organisations";

/*
 * Uploaded images (logos), scoped to an organisation like every other tenant row.
 * Not cached with "use cache": the media route sets long-lived HTTP caching instead, and an
 * id's bytes never change.
 */

export type SaveMediaResult =
  | { ok: true; id: string; path: string }
  | { ok: false; error: "too-large" | "not-an-image" | "empty" };

/** Store an image (deduplicated per organisation) and return its public path. */
export async function saveMedia(scope: OrgScope, bytes: Uint8Array, db: Db = getDb()): Promise<SaveMediaResult> {
  if (!bytes.length) return { ok: false, error: "empty" };
  if (bytes.length > MAX_MEDIA_BYTES) return { ok: false, error: "too-large" };
  const contentType = sniffImageType(bytes);
  if (!contentType) return { ok: false, error: "not-an-image" };
  const buffer = Buffer.from(bytes);
  const sha256 = createHash("sha256").update(buffer).digest("hex");
  await db
    .insert(media)
    .values({ organisationId: scope.id, contentType, bytes: buffer, byteSize: buffer.length, sha256 })
    .onConflictDoNothing({ target: [media.organisationId, media.sha256] });
  const [row] = await db
    .select({ id: media.id, contentType: media.contentType })
    .from(media)
    .where(and(eq(media.organisationId, scope.id), eq(media.sha256, sha256)))
    .limit(1);
  return { ok: true, id: row!.id, path: mediaPath(scope.slug, row!.id, row!.contentType as MediaType) };
}

export async function getMedia(
  scope: OrgScope,
  id: string,
  db: Db = getDb(),
): Promise<{ contentType: MediaType; bytes: Buffer } | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await db
    .select({ contentType: media.contentType, bytes: media.bytes })
    .from(media)
    .where(and(eq(media.organisationId, scope.id), eq(media.id, id)))
    .limit(1);
  // node-postgres returns a Buffer, PGlite a Uint8Array.
  return row ? { contentType: row.contentType as MediaType, bytes: Buffer.from(row.bytes) } : null;
}

/** For public URLs (/media/{org}/{id}.png): resolve the organisation from its slug first. */
export async function getPublicMedia(orgSlug: string, id: string) {
  const resolved = await resolveOrgBySlug(orgSlug);
  return resolved ? getMedia(resolved.scope, id) : null;
}
