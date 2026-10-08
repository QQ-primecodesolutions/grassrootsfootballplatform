/**
 * Login lockout rules (pure). Failed sign-ins are counted per client IP in Postgres,
 * because Vercel runs several instances. A correct sign-in clears that IP's count.
 * Counting per IP (not per account) means a stranger can't lock the real admin out.
 */

export const LOCKOUT = {
  /** Failed attempts from one IP within the window before it is blocked. */
  perIp: 5,
  /** Failed attempts from all IPs together within the window before sign-in pauses. */
  global: 100,
  windowMinutes: 15,
} as const;

const WINDOW_MS = LOCKOUT.windowMinutes * 60_000;

export type LockoutState =
  | { blocked: false; attemptsLeft: number }
  | { blocked: true; reason: "ip" | "global"; retryAfterMinutes: number };

/**
 * @param ipFailures this IP's most recent failures, newest first
 * @param globalFailures failures from all IPs within the window
 */
export function lockoutState(ipFailures: Date[], globalFailures: number, now: Date): LockoutState {
  const recent = ipFailures.filter((d) => now.getTime() - d.getTime() < WINDOW_MS);
  if (recent.length >= LOCKOUT.perIp) {
    // Blocked until the oldest of the last `perIp` failures leaves the window.
    const releaseAt = recent[LOCKOUT.perIp - 1]!.getTime() + WINDOW_MS;
    return { blocked: true, reason: "ip", retryAfterMinutes: Math.max(1, Math.ceil((releaseAt - now.getTime()) / 60_000)) };
  }
  if (globalFailures >= LOCKOUT.global) return { blocked: true, reason: "global", retryAfterMinutes: LOCKOUT.windowMinutes };
  return { blocked: false, attemptsLeft: LOCKOUT.perIp - recent.length };
}

export function windowStart(now: Date): Date {
  return new Date(now.getTime() - WINDOW_MS);
}

export function lockoutMessage(state: Extract<LockoutState, { blocked: true }>): string {
  const minutes = `${state.retryAfterMinutes} minute${state.retryAfterMinutes === 1 ? "" : "s"}`;
  return state.reason === "ip"
    ? `Too many wrong attempts from this device. Try again in ${minutes}.`
    : `Sign-in is paused because of many failed attempts. Try again in ${minutes}.`;
}

/**
 * The caller's IP. On Vercel these headers are set by the platform (clients can't spoof
 * them). Elsewhere they may be missing, and all callers share the "unknown" bucket.
 */
export function clientIp(headers: Pick<Headers, "get">): string {
  const real = headers.get("x-real-ip")?.trim();
  if (real) return real.slice(0, 64);
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded ? forwarded.slice(0, 64) : "unknown";
}
