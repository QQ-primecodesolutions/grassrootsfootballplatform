"use server";

import { redirect } from "next/navigation";
import { refresh, updateTag } from "next/cache";
import { z } from "zod";
import { getCurrentSuperAdmin, setSession } from "@/lib/auth";
import { LINK_LIFETIME_HOURS, setPasswordPath, type LinkPurpose } from "@/lib/auth/tokens";
import { ORGANISATIONS_TAG, orgTag } from "@/lib/cache/tags";
import {
  createOrganisation,
  getOrgMember,
  inviteOrgAdmin,
  issuePasswordLink,
  removeOrgAdmin,
  setOrganisationListed,
  updateOrganisation,
} from "@/lib/db/queries/platform";
import { publicEnv, siteUrl } from "@/lib/env";
import { inviteSchema, organisationCreateSchema, organisationUpdateSchema } from "@/lib/platform/organisation-input";

export type OrgFormState = { ok: boolean; message: string | null };
export type LinkState = {
  ok: boolean;
  message: string | null;
  /** A one-time link to send on WhatsApp (shown once; only its hash is stored). */
  link?: { url: string; whatsappText: string; purpose: LinkPurpose };
};

function invalidateOrg(orgId: string) {
  updateTag(ORGANISATIONS_TAG);
  updateTag(orgTag(orgId));
  refresh();
}

const orgId = z.object({ orgId: z.uuid() });

export async function createOrganisationAction(_prev: OrgFormState, formData: FormData): Promise<OrgFormState> {
  const { platform } = await getCurrentSuperAdmin();
  const parsed = organisationCreateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the form" };
  const created = await createOrganisation(platform, parsed.data);
  if (!created.ok) return { ok: false, message: `The link name "${parsed.data.slug}" is already taken. Pick another.` };
  invalidateOrg(created.id);
  redirect(`/admin/platform/${created.id}?created=1`);
}

export async function updateOrganisationAction(_prev: OrgFormState, formData: FormData): Promise<OrgFormState> {
  const { platform } = await getCurrentSuperAdmin();
  const id = orgId.safeParse(Object.fromEntries(formData));
  const parsed = organisationUpdateSchema.safeParse(Object.fromEntries(formData));
  if (!id.success) return { ok: false, message: "Unknown organisation" };
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the form" };
  if (!(await updateOrganisation(platform, id.data.orgId, parsed.data))) return { ok: false, message: "Unknown organisation" };
  invalidateOrg(id.data.orgId);
  return { ok: true, message: "Saved. The public site and graphics update within seconds." };
}

export async function setListedAction(formData: FormData): Promise<void> {
  const { platform } = await getCurrentSuperAdmin();
  const parsed = orgId.extend({ listed: z.enum(["true", "false"]) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  if (await setOrganisationListed(platform, parsed.data.orgId, parsed.data.listed === "true")) invalidateOrg(parsed.data.orgId);
}

/** Open the normal admin screens for this organisation. */
export async function workInOrganisationAction(formData: FormData): Promise<void> {
  const { user } = await getCurrentSuperAdmin();
  const parsed = orgId.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  await setSession(user, parsed.data.orgId);
  redirect("/admin");
}

function linkFor(token: string, purpose: LinkPurpose, name: string, orgName: string): NonNullable<LinkState["link"]> {
  const url = `${siteUrl()}${setPasswordPath(token)}`;
  const days = LINK_LIFETIME_HOURS[purpose] / 24;
  const valid = days >= 2 ? `${days} days` : `${LINK_LIFETIME_HOURS[purpose]} hours`;
  const whatsappText =
    purpose === "invite"
      ? `Hi ${name}, you've been added as an admin for ${orgName} on ${publicEnv.NEXT_PUBLIC_APP_NAME}. Open this link to choose your password (it works once and expires in ${valid}):\n${url}`
      : `Hi ${name}, here's your link to choose a new ${publicEnv.NEXT_PUBLIC_APP_NAME} admin password (it works once and expires in ${valid}):\n${url}`;
  return { url, whatsappText, purpose };
}

export async function inviteAdminAction(_prev: LinkState, formData: FormData): Promise<LinkState> {
  const { platform } = await getCurrentSuperAdmin();
  const id = orgId.extend({ orgName: z.string().max(100) }).safeParse(Object.fromEntries(formData));
  const parsed = inviteSchema.safeParse(Object.fromEntries(formData));
  if (!id.success) return { ok: false, message: "Unknown organisation" };
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the form" };

  const result = await inviteOrgAdmin(platform, id.data.orgId, parsed.data, new Date());
  if (!result) return { ok: false, message: "Unknown organisation" };
  refresh();
  if (result.kind === "added") {
    return {
      ok: true,
      message: `${result.name} already has an account. They can switch to ${id.data.orgName} next time they sign in.`,
    };
  }
  return {
    ok: true,
    message: `Invite created for ${parsed.data.name}. Send them this link now: it is shown only once.`,
    link: linkFor(result.token, "invite", parsed.data.name, id.data.orgName),
  };
}

/** A fresh invite link (not yet active) or a password reset link (active). */
export async function memberLinkAction(_prev: LinkState, formData: FormData): Promise<LinkState> {
  const { platform } = await getCurrentSuperAdmin();
  const parsed = orgId
    .extend({ userId: z.uuid(), name: z.string().max(80), orgName: z.string().max(100) })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: "Unknown admin" };
  const member = await getOrgMember(platform, parsed.data.orgId, parsed.data.userId);
  if (!member) return { ok: false, message: "That person is no longer an admin here." };
  const purpose: LinkPurpose = member.active ? "reset" : "invite";
  const token = await issuePasswordLink(platform, member.userId, purpose, new Date());
  return {
    ok: true,
    message: "New link created. Any earlier link for this person no longer works.",
    link: linkFor(token, purpose, parsed.data.name, parsed.data.orgName),
  };
}

export async function removeAdminAction(formData: FormData): Promise<void> {
  const { platform } = await getCurrentSuperAdmin();
  const parsed = orgId.extend({ userId: z.uuid() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  await removeOrgAdmin(platform, parsed.data.orgId, parsed.data.userId);
  refresh();
}
