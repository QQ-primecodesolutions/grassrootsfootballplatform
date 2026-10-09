"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { inviteLinkFor, type ShareableLink } from "@/lib/admin/invite-links";
import { getCurrentAdmin } from "@/lib/auth";
import { addScorer, removeScorer, scorerLink } from "@/lib/db/queries/people";
import { inviteSchema } from "@/lib/platform/organisation-input";

export type PeopleState = { ok: boolean; message: string | null; link?: ShareableLink };

const initialMessage = (name: string) => `${name} already has an account and can now enter scores here.`;

/** An organisation admin adds a scorer (never another admin: that stays with the platform admin). */
export async function addScorerAction(_prev: PeopleState, formData: FormData): Promise<PeopleState> {
  const { scope, org, user } = await getCurrentAdmin();
  const parsed = inviteSchema.omit({ role: true }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the form" };

  const result = await addScorer(scope, parsed.data, { userId: user.id }, new Date());
  refresh();
  switch (result.kind) {
    case "link":
      return {
        ok: true,
        message: `Invite created for ${parsed.data.name}. Send them this link now: it is shown only once.`,
        link: inviteLinkFor(result.token, "invite", parsed.data.name, org.name, "scorer"),
      };
    case "added":
      return { ok: true, message: initialMessage(result.name) };
    case "already-admin":
      return { ok: false, message: `${result.name} is already an organisation admin here.` };
    case "pending-elsewhere":
      return {
        ok: true,
        message: `${result.name} was added as a scorer, but still has to accept an earlier invite. Ask them to use that link, or ask the platform admin for a new one.`,
      };
  }
}

export async function scorerLinkAction(_prev: PeopleState, formData: FormData): Promise<PeopleState> {
  const { scope, org, user } = await getCurrentAdmin();
  const userId = z.uuid().safeParse(formData.get("userId"));
  if (!userId.success) return { ok: false, message: "Unknown person" };
  const created = await scorerLink(scope, userId.data, { userId: user.id }, new Date());
  if (!created) return { ok: false, message: "You can only send links to scorers who belong to this organisation only. Ask the platform admin." };
  return {
    ok: true,
    message: "New link created. Any earlier link for this person no longer works.",
    link: inviteLinkFor(created.token, created.purpose, created.name, org.name, "scorer"),
  };
}

export async function removeScorerAction(formData: FormData): Promise<void> {
  const { scope } = await getCurrentAdmin();
  const userId = z.uuid().safeParse(formData.get("userId"));
  if (!userId.success) return;
  await removeScorer(scope, userId.data);
  refresh();
}
