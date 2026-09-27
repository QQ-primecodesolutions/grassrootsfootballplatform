"use server";

import { refresh, updateTag } from "next/cache";
import { getCurrentAdmin } from "@/lib/auth";
import { tagsForMatchChange } from "@/lib/cache/tags";
import { getAdminMatch, saveMatchResult } from "@/lib/db/queries/admin";
import { buildResultPatch, resultFormSchema, type ResultErrors } from "@/lib/match/result-input";

export type SaveResultState = { ok: boolean; message: string | null; errors: ResultErrors };

export async function saveResult(_prev: SaveResultState, formData: FormData): Promise<SaveResultState> {
  // Re-verify the session here: the proxy is not the security boundary.
  const { scope } = await getCurrentAdmin();

  // Empty inputs mean "not entered".
  const raw = Object.fromEntries([...formData.entries()].filter(([, v]) => v !== ""));
  const parsed = resultFormSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the form", errors: { form: "Check the form" } };
  }

  const match = await getAdminMatch(scope, parsed.data.matchId);
  if (!match) return { ok: false, message: "That match wasn't found in this organisation.", errors: {} };

  const built = buildResultPatch(parsed.data, {
    competitionType: match.competitionType,
    homeEntryId: match.homeEntryId,
    awayEntryId: match.awayEntryId,
  });
  if (!built.ok) return { ok: false, message: "Please fix the highlighted fields.", errors: built.errors };

  const confirming = built.patch.resultState === "confirmed";
  // Keep the original confirmation time when re-saving an already confirmed result.
  const confirmedAt = confirming ? (match.resultState === "confirmed" && match.confirmedAt) || new Date() : null;

  let saved;
  try {
    saved = await saveMatchResult(scope, match.id, { ...built.patch, confirmedAt });
  } catch (error) {
    console.error("saveResult failed", error);
    return { ok: false, message: "The result couldn't be saved. Please try again.", errors: {} };
  }
  if (!saved) return { ok: false, message: "That match wasn't found in this organisation.", errors: {} };

  // Public pages (table, fixtures, results, match, team pages) refresh immediately.
  for (const tag of tagsForMatchChange({
    organisationId: scope.id,
    competitionId: saved.competitionId,
    matchId: match.id,
    teamIds: [match.home.teamId, match.away.teamId],
  })) {
    updateTag(tag);
  }
  refresh();

  const message =
    built.patch.status !== "completed"
      ? `Saved: match marked as ${built.patch.status}. This shows on the public site now.`
      : confirming
        ? "Published. The public table is updated."
        : "Saved as provisional. It won't show on the public site until you confirm it.";
  return { ok: true, message, errors: {} };
}
