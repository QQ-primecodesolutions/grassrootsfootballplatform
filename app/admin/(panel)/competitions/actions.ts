"use server";

import { redirect } from "next/navigation";
import { refresh, updateTag } from "next/cache";
import { z } from "zod";
import { getCurrentAdmin } from "@/lib/auth";
import { competitionTag, orgTag, teamTag } from "@/lib/cache/tags";
import {
  adjustmentSchema,
  competitionCreateSchema,
  competitionUpdateSchema,
  parseTeamNames,
  rulesFormSchema,
} from "@/lib/competitions/input";
import type { OrgScope } from "@/lib/db/queries";
import {
  addEntries,
  addPointsAdjustment,
  createCompetition,
  createTeamsAndEnter,
  deleteCompetition,
  removeEntry,
  removePointsAdjustment,
  updateCompetition,
  updateCompetitionRules,
} from "@/lib/db/queries/setup";

export type SetupFormState = { ok: boolean; message: string | null; nonce: number };

const ids = z.object({ competitionId: z.uuid() });

function invalidate(scope: OrgScope, competitionId: string, teamIds: string[] = []) {
  for (const tag of [orgTag(scope.id), competitionTag(competitionId), ...teamIds.map(teamTag)]) updateTag(tag);
  refresh();
}

const fail = (prev: SetupFormState, message: string): SetupFormState => ({ ok: false, message, nonce: prev.nonce + 1 });
const done = (prev: SetupFormState, message: string): SetupFormState => ({ ok: true, message, nonce: prev.nonce + 1 });

export async function createCompetitionAction(prev: SetupFormState, formData: FormData): Promise<SetupFormState> {
  const { scope } = await getCurrentAdmin();
  const parsed = competitionCreateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(prev, parsed.error.issues[0]?.message ?? "Check the form");
  const created = await createCompetition(scope, parsed.data);
  if (!created.ok) return fail(prev, `The link name "${parsed.data.slug}" is already used by another competition.`);
  invalidate(scope, created.id);
  redirect(`/admin/competitions/${created.id}?created=1`);
}

export async function updateCompetitionAction(prev: SetupFormState, formData: FormData): Promise<SetupFormState> {
  const { scope } = await getCurrentAdmin();
  const id = ids.safeParse(Object.fromEntries(formData));
  const parsed = competitionUpdateSchema.safeParse(Object.fromEntries(formData));
  if (!id.success) return fail(prev, "Unknown competition");
  if (!parsed.success) return fail(prev, parsed.error.issues[0]?.message ?? "Check the form");
  if (!(await updateCompetition(scope, id.data.competitionId, parsed.data))) return fail(prev, "Unknown competition");
  invalidate(scope, id.data.competitionId);
  return done(prev, "Saved. Public pages update within seconds.");
}

export async function updateRulesAction(prev: SetupFormState, formData: FormData): Promise<SetupFormState> {
  const { scope } = await getCurrentAdmin();
  const id = ids.safeParse(Object.fromEntries(formData));
  const parsed = rulesFormSchema.safeParse(Object.fromEntries(formData));
  if (!id.success) return fail(prev, "Unknown competition");
  if (!parsed.success) return fail(prev, parsed.error.issues[0]?.message ?? "Check the rules");
  if (!(await updateCompetitionRules(scope, id.data.competitionId, parsed.data))) return fail(prev, "Unknown competition");
  invalidate(scope, id.data.competitionId);
  return done(prev, "Rules saved. The table has been recalculated.");
}

export async function deleteCompetitionAction(formData: FormData): Promise<void> {
  const { scope } = await getCurrentAdmin();
  const id = ids.safeParse(Object.fromEntries(formData));
  if (!id.success) return;
  const result = await deleteCompetition(scope, id.data.competitionId);
  if (result !== "deleted") return;
  invalidate(scope, id.data.competitionId);
  redirect("/admin/competitions?deleted=1");
}

export async function addEntriesAction(prev: SetupFormState, formData: FormData): Promise<SetupFormState> {
  const { scope } = await getCurrentAdmin();
  const id = ids.safeParse(Object.fromEntries(formData));
  const teamIds = z.array(z.uuid()).max(200).safeParse(formData.getAll("teamId"));
  if (!id.success || !teamIds.success) return fail(prev, "Unknown competition or team");
  if (!teamIds.data.length) return fail(prev, "Tick the teams to add first.");
  const added = await addEntries(scope, id.data.competitionId, teamIds.data);
  if (added === null) return fail(prev, "Unknown competition");
  invalidate(scope, id.data.competitionId, added);
  return done(prev, `Added ${added.length} team${added.length === 1 ? "" : "s"}.`);
}

export async function addNewTeamsAction(prev: SetupFormState, formData: FormData): Promise<SetupFormState> {
  const { scope } = await getCurrentAdmin();
  const parsed = ids
    .extend({
      names: z.string().max(5000),
      category: z.string().trim().min(1, "Enter a category, e.g. Open or U19").max(20),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(prev, parsed.error.issues[0]?.message ?? "Check the form");
  const names = parseTeamNames(parsed.data.names);
  if (!names.length) return fail(prev, "Type or paste at least one team name.");
  if (names.length > 64) return fail(prev, "Add at most 64 teams at a time.");
  const result = await createTeamsAndEnter(scope, parsed.data.competitionId, names, parsed.data.category);
  if (!result) return fail(prev, "Unknown competition");
  invalidate(scope, parsed.data.competitionId);
  const parts = [`${result.created} new team${result.created === 1 ? "" : "s"} created`];
  if (result.reused) parts.push(`${result.reused} existing team${result.reused === 1 ? "" : "s"} reused`);
  return done(prev, `${parts.join(", ")} and entered. Edit names, short names or logos under Teams.`);
}

export async function removeEntryAction(formData: FormData): Promise<void> {
  const { scope } = await getCurrentAdmin();
  const parsed = ids.extend({ entryId: z.uuid() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  const removed = await removeEntry(scope, parsed.data.competitionId, parsed.data.entryId);
  if (removed.result === "removed") invalidate(scope, parsed.data.competitionId, [removed.teamId]);
}

export async function addAdjustmentAction(prev: SetupFormState, formData: FormData): Promise<SetupFormState> {
  const { scope } = await getCurrentAdmin();
  const id = ids.safeParse(Object.fromEntries(formData));
  const parsed = adjustmentSchema.safeParse(Object.fromEntries(formData));
  if (!id.success) return fail(prev, "Unknown competition");
  if (!parsed.success) return fail(prev, parsed.error.issues[0]?.message ?? "Check the form");
  const result = await addPointsAdjustment(scope, id.data.competitionId, parsed.data);
  if (result === "not-found") return fail(prev, "That team isn't in this competition.");
  if (result === "duplicate") return fail(prev, "That adjustment is already recorded.");
  invalidate(scope, id.data.competitionId);
  return done(prev, "Adjustment added. The table has been recalculated.");
}

export async function removeAdjustmentAction(formData: FormData): Promise<void> {
  const { scope } = await getCurrentAdmin();
  const parsed = ids.extend({ adjustmentId: z.uuid() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  if (await removePointsAdjustment(scope, parsed.data.competitionId, parsed.data.adjustmentId)) {
    invalidate(scope, parsed.data.competitionId);
  }
}
