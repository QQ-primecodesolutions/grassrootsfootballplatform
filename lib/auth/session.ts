import { SignJWT, jwtVerify } from "jose";

/**
 * Admin session: an HS256-signed JWT in an httpOnly cookie.
 * Kept free of Next.js imports so proxy.ts, Server Actions and tests can share it.
 */

export const SESSION_COOKIE = "admin_session";
export const SESSION_MAX_AGE_SECONDS = 14 * 24 * 60 * 60; // 14 days (PLAN.md decision 13)

export type SessionPayload = {
  /** The signed-in user's id. */
  sub: string;
  /** The organisation the user is working in (null: none yet, e.g. a new super admin). */
  orgId: string | null;
  /** users.session_version at sign-in; bumping it signs the user out everywhere. */
  sv: number;
};

const key = (secret: string) => new TextEncoder().encode(secret);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function signSession(payload: SessionPayload, secret: string, now = new Date()): Promise<string> {
  const iat = Math.floor(now.getTime() / 1000);
  return new SignJWT({ orgId: payload.orgId, sv: payload.sv })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt(iat)
    .setExpirationTime(iat + SESSION_MAX_AGE_SECONDS)
    .sign(key(secret));
}

/** Returns the payload, or null for a missing, tampered, expired or old-format token. */
export async function verifySession(token: string | undefined, secret: string): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(secret), { algorithms: ["HS256"] });
    const { sub, orgId, sv } = payload;
    if (typeof sub !== "string" || !UUID.test(sub)) return null;
    if (orgId !== null && (typeof orgId !== "string" || !UUID.test(orgId))) return null;
    if (typeof sv !== "number" || !Number.isInteger(sv)) return null;
    return { sub, orgId, sv };
  } catch {
    return null;
  }
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/admin",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}
