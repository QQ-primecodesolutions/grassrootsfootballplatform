/**
 * node-postgres 8 treats `sslmode=prefer|require|verify-ca` as `verify-full` and warns that
 * pg 9 will switch to libpq's weaker meaning (encrypt without verifying the certificate).
 * Neon's connection strings use `sslmode=require`, so ask for `verify-full` explicitly:
 * same behaviour today, and it can't silently weaken on a pg upgrade. Other URLs pass through.
 */
export function withVerifiedTls(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  const mode = parsed.searchParams.get("sslmode");
  if (mode === "prefer" || mode === "require" || mode === "verify-ca") {
    parsed.searchParams.set("sslmode", "verify-full");
    return parsed.toString();
  }
  return url;
}
