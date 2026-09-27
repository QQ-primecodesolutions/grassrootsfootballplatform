import type { CSSProperties } from "react";
import { notFound } from "next/navigation";
import { resolveOrgBySlug, type PublicOrganisation } from "@/lib/db/queries";
import { readableTextOn } from "./color";

/** Resolve the organisation for a public route, or render the 404 page. */
export async function requireOrg(slug: string) {
  const resolved = await resolveOrgBySlug(slug);
  if (!resolved) notFound();
  return resolved;
}

/** CSS variables that theme the public pages with the organisation's branding. */
export function brandStyle(org: PublicOrganisation): CSSProperties {
  return {
    "--brand-primary": org.primaryColor,
    "--brand-secondary": org.secondaryColor,
    "--brand-on-primary": readableTextOn(org.primaryColor),
    "--brand-on-secondary": readableTextOn(org.secondaryColor),
    "--brand-text": org.textColor,
    "--brand-bg": org.backgroundColor,
  } as CSSProperties;
}
