import type { SocialLinks } from "@/lib/db/queries";

/**
 * An organiser-supplied link, only if it is a plain https URL (never `javascript:` or similar).
 * Facebook's `web.` and `m.` hosts are normalised to `www.`, which works in browsers and opens
 * the Facebook app on phones.
 */
export function safeExternalUrl(url: string | undefined | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return null;
    if (u.hostname === "web.facebook.com" || u.hostname === "m.facebook.com") u.hostname = "www.facebook.com";
    return u.toString();
  } catch {
    return null;
  }
}

export function facebookUrl(links: SocialLinks | null | undefined): string | null {
  return safeExternalUrl(links?.facebook);
}
