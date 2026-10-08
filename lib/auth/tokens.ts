import { createHash, randomBytes } from "node:crypto";

/** One-time invite / reset links: 256 random bits in the URL, only the SHA-256 in the database. */
export function newLinkToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashLinkToken(token) };
}

export function hashLinkToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Shape check before touching the database. */
export function isLinkTokenShape(token: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}

export type LinkPurpose = "invite" | "reset";

export const LINK_LIFETIME_HOURS: Record<LinkPurpose, number> = { invite: 7 * 24, reset: 24 };

export function setPasswordPath(token: string): string {
  return `/admin/set-password/${token}`;
}
