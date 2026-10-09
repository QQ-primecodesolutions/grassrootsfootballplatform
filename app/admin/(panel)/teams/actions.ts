"use server";

import { redirect } from "next/navigation";
import { refresh, updateTag } from "next/cache";
import { z } from "zod";
import { getCurrentAdmin } from "@/lib/auth";
import { orgTag, teamTag } from "@/lib/cache/tags";
import { isAcceptedLogoValue } from "@/lib/media/image";
import { addTeamAlias, createTeam, removeTeamAlias, updateTeam, type TeamInput } from "@/lib/db/queries/admin";

export type TeamFormState = { ok: boolean; message: string | null };

const optional = (schema: z.ZodString) =>
  schema.optional().or(z.literal("").transform(() => undefined)).transform((v) => v ?? null);

const teamSchema = z
  .object({
    name: z.string().trim().min(2, "Enter the team's official name").max(80),
    shortName: z.string().trim().min(1, "Enter a short name for graphics").max(24, "Keep the short name under 24 characters"),
    category: z.string().trim().min(1, "Enter a category, e.g. Open or U19").max(20),
    gender: z.enum(["male", "female", "mixed", ""]).transform((v) => (v === "" ? null : v)),
    clubId: optional(z.string()),
    newClubName: optional(z.string().trim().max(80)),
    logoUrl: optional(z.string().trim().max(500).refine(isAcceptedLogoValue, "Upload a logo, or use a full https:// link")),
  })
  .transform((t) => ({
    ...t,
    // "__new" (or nothing chosen) means: create a club, named after the team unless given.
    clubId: t.clubId && t.clubId !== "__new" ? t.clubId : null,
    newClubName: t.clubId && t.clubId !== "__new" ? null : t.newClubName || t.name,
  }));

function invalidateTeam(orgId: string, teamId: string) {
  // Team names appear in cached competition data, which is tagged per organisation.
  updateTag(orgTag(orgId));
  updateTag(teamTag(teamId));
  refresh();
}

export async function createTeamAction(_prev: TeamFormState, formData: FormData): Promise<TeamFormState> {
  const { scope } = await getCurrentAdmin();
  const parsed = teamSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the form" };
  let created;
  try {
    created = await createTeam(scope, parsed.data as TeamInput);
  } catch (error) {
    console.error("createTeam failed", error);
    return { ok: false, message: "The team couldn't be saved. Is the club still there?" };
  }
  invalidateTeam(scope.id, created.id);
  redirect(`/admin/teams/${created.id}?created=1`);
}

export async function updateTeamAction(_prev: TeamFormState, formData: FormData): Promise<TeamFormState> {
  const { scope } = await getCurrentAdmin();
  const teamId = z.uuid().safeParse(formData.get("teamId"));
  if (!teamId.success) return { ok: false, message: "Unknown team" };
  const parsed = teamSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the form" };
  const ok = await updateTeam(scope, teamId.data, parsed.data as TeamInput).catch((error) => {
    console.error("updateTeam failed", error);
    return false;
  });
  if (!ok) return { ok: false, message: "The team couldn't be saved." };
  invalidateTeam(scope.id, teamId.data);
  return { ok: true, message: "Saved." };
}

export async function addAliasAction(_prev: TeamFormState, formData: FormData): Promise<TeamFormState> {
  const { scope } = await getCurrentAdmin();
  const parsed = z
    .object({ teamId: z.uuid(), alias: z.string().trim().min(2, "Type the other spelling").max(80) })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the alias" };
  const ok = await addTeamAlias(scope, parsed.data.teamId, parsed.data.alias);
  if (!ok) return { ok: false, message: "Unknown team" };
  refresh();
  return { ok: true, message: `Added “${parsed.data.alias}”.` };
}

export async function removeAliasAction(formData: FormData): Promise<void> {
  const { scope } = await getCurrentAdmin();
  const aliasId = z.uuid().safeParse(formData.get("aliasId"));
  if (!aliasId.success) return;
  await removeTeamAlias(scope, aliasId.data);
  refresh();
}
