"use server";

import { z } from "zod";
import { getCurrentAdmin, getCurrentSuperAdmin } from "@/lib/auth";
import type { OrgScope } from "@/lib/db/queries";
import { saveMedia } from "@/lib/db/queries/media";
import { orgScopeForPlatform } from "@/lib/db/queries/platform";
import { MAX_MEDIA_BYTES } from "@/lib/media/image";

export type UploadResult = { ok: true; path: string } | { ok: false; message: string };

const MESSAGES = {
  "too-large": `That image is too big. Use one under ${Math.round(MAX_MEDIA_BYTES / 1_000_000)} MB.`,
  "not-an-image": "That file isn't a PNG or JPEG image.",
  empty: "That file is empty.",
} as const;

/**
 * Upload a logo image. The browser has already shrunk it (components/admin/resize-image.ts);
 * the server checks the bytes again. With `orgId`, a super admin uploads for that organisation
 * (Platform page); otherwise it goes to the organisation the admin is working in.
 * Saving the form that holds the returned path is what actually changes a logo.
 */
export async function uploadLogoAction(formData: FormData): Promise<UploadResult> {
  const orgId = z.uuid().optional().safeParse(formData.get("orgId") || undefined);
  if (!orgId.success) return { ok: false, message: "Unknown organisation" };

  let scope: OrgScope | null;
  if (orgId.data) {
    const { platform } = await getCurrentSuperAdmin();
    scope = await orgScopeForPlatform(platform, orgId.data);
  } else {
    scope = (await getCurrentAdmin()).scope;
  }
  if (!scope) return { ok: false, message: "Unknown organisation" };

  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, message: "Choose an image first." };
  if (file.size > MAX_MEDIA_BYTES) return { ok: false, message: MESSAGES["too-large"] };

  const saved = await saveMedia(scope, new Uint8Array(await file.arrayBuffer()));
  return saved.ok ? { ok: true, path: saved.path } : { ok: false, message: MESSAGES[saved.error] };
}
