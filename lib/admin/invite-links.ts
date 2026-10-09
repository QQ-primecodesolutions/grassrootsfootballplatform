import { LINK_LIFETIME_HOURS, setPasswordPath, type LinkPurpose } from "@/lib/auth/tokens";
import { publicEnv, siteUrl } from "@/lib/env";

/** A one-time link to show once and send on WhatsApp (only its hash is stored). */
export type ShareableLink = { url: string; whatsappText: string; purpose: LinkPurpose };

/** The full link and its WhatsApp message, for invites and password resets. */
export function inviteLinkFor(
  token: string,
  purpose: LinkPurpose,
  name: string,
  orgName: string,
  role: "org_admin" | "scorer" = "org_admin",
): ShareableLink {
  const url = `${siteUrl()}${setPasswordPath(token)}`;
  const days = LINK_LIFETIME_HOURS[purpose] / 24;
  const valid = days >= 2 ? `${days} days` : `${LINK_LIFETIME_HOURS[purpose]} hours`;
  const app = publicEnv.NEXT_PUBLIC_APP_NAME;
  const whatsappText =
    purpose === "invite"
      ? `Hi ${name}, you've been added as ${role === "scorer" ? "a scorer" : "an admin"} for ${orgName} on ${app}. Open this link to choose your password (it works once and expires in ${valid}):\n${url}`
      : `Hi ${name}, here's your link to choose a new ${app} password (it works once and expires in ${valid}):\n${url}`;
  return { url, whatsappText, purpose };
}
