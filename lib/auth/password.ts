import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Constant-time password check. Both sides are hashed first so the comparison
 * runs over equal-length buffers regardless of input length.
 */
export function passwordMatches(input: string, expected: string): boolean {
  const a = createHash("sha256").update(input, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}
