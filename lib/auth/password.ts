import { randomBytes, scrypt as scryptCallback, timingSafeEqual, type ScryptOptions } from "node:crypto";

/**
 * Password hashing with scrypt from Node's standard library (no extra dependency).
 * Stored format: `scrypt$N$r$p$salt$hash` (base64url), so the cost can be raised later
 * without breaking existing hashes.
 */

const COST = { N: 16_384, r: 8, p: 1 } as const;
const KEY_LENGTH = 32;

function scrypt(password: string, salt: Buffer, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scryptCallback(password.normalize("NFKC"), salt, KEY_LENGTH, { ...options, maxmem: 64 * 1024 * 1024 }, (err, key) =>
      err ? reject(err) : resolve(key),
    ),
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, COST);
  return ["scrypt", COST.N, COST.r, COST.p, salt.toString("base64url"), key.toString("base64url")].join("$");
}

// Checked against when the email is unknown, so a wrong email takes as long as a wrong password.
const DUMMY_HASH = `scrypt$${COST.N}$${COST.r}$${COST.p}$${"A".repeat(22)}$${"A".repeat(43)}`;

/** Constant-time check. `stored` null (unknown user, or invite not yet accepted) always fails. */
export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  const parts = (stored ?? DUMMY_HASH).split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [N, r, p] = parts.slice(1, 4).map(Number);
  if (!N || !r || !p || N > 1_048_576) return false;
  const expected = Buffer.from(parts[5]!, "base64url");
  const actual = await scrypt(password, Buffer.from(parts[4]!, "base64url"), { N, r, p });
  return stored !== null && actual.length === expected.length && timingSafeEqual(actual, expected);
}
