import { SignJWT, jwtVerify } from "jose";

/**
 * Prototype admin session: an HS256-signed JWT in an httpOnly cookie.
 * Kept free of Next.js imports so proxy.ts, Server Actions and tests can share it.
 */

export const SESSION_COOKIE = "admin_session";
export const SESSION_MAX_AGE_SECONDS = 14 * 24 * 60 * 60; // 14 days (PLAN.md decision 13)

export type SessionPayload = {
  /** Always "admin" for the single-password prototype. */
  sub: "admin";
  /** The organisation the admin is currently working in. */
  orgId: string;
};

const key = (secret: string) => new TextEncoder().encode(secret);

export async function signSession(payload: SessionPayload, secret: string, now = new Date()): Promise<string> {
  const iat = Math.floor(now.getTime() / 1000);
  return new SignJWT({ orgId: payload.orgId })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt(iat)
    .setExpirationTime(iat + SESSION_MAX_AGE_SECONDS)
    .sign(key(secret));
}

/** Returns the payload, or null for a missing, tampered or expired token. */
export async function verifySession(token: string | undefined, secret: string): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(secret), { algorithms: ["HS256"] });
    if (payload.sub !== "admin" || typeof payload.orgId !== "string") return null;
    return { sub: "admin", orgId: payload.orgId };
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
