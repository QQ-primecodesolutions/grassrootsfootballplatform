import { z } from "zod";
import type { MatchStatus, OutcomeType, ResultState } from "@/lib/standings";

/**
 * Pure validation for the result-entry form. Turns what the admin entered into the
 * exact columns to write, enforcing the same rules as the DB CHECK constraints
 * with friendly messages. The caller adds `confirmedAt` (no clock in here).
 */

const goals = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
  z.number({ error: "Enter a number" }).int("Whole numbers only").min(0, "Can't be negative").max(99, "Too high").nullable(),
);

export const resultFormSchema = z.object({
  matchId: z.uuid(),
  intent: z.enum(["provisional", "confirm"]),
  status: z.enum(["scheduled", "postponed", "cancelled", "abandoned", "completed"]),
  outcome: z.enum(["normal", "walkover", "awarded"]).default("normal"),
  homeGoals: goals.optional(),
  awayGoals: goals.optional(),
  htHome: goals.optional(),
  htAway: goals.optional(),
  aetHome: goals.optional(),
  aetAway: goals.optional(),
  penHome: goals.optional(),
  penAway: goals.optional(),
  walkoverWinner: z.enum(["home", "away"]).nullable().optional(),
  notes: z
    .string()
    .trim()
    .max(500, "Keep the note under 500 characters")
    .optional()
    .transform((v) => (v ? v : null)),
});

export type ResultFormInput = z.infer<typeof resultFormSchema>;

/**
 * What a result may contain, by competition type and stage:
 * - league, and the group stage of groups + knockout: draws allowed; no extra time or penalties.
 * - knockout, and the knockout stage of groups + knockout: a winner is required.
 * - friendly: draws allowed; extra time and penalties optional.
 */
export function resultRulesFor(
  competitionType: "league" | "knockout" | "group_knockout" | "friendly",
  stage: "group" | "knockout" | null | undefined,
): { extrasAllowed: boolean; winnerRequired: boolean } {
  if (competitionType === "league" || (competitionType === "group_knockout" && stage === "group")) {
    return { extrasAllowed: false, winnerRequired: false };
  }
  if (competitionType === "friendly") return { extrasAllowed: true, winnerRequired: false };
  return { extrasAllowed: true, winnerRequired: true };
}

export type ResultContext = {
  /** Groups + knockout only: group matches follow league rules. */
  stage?: "group" | "knockout" | null;
  competitionType: "league" | "knockout" | "group_knockout" | "friendly";
  homeEntryId: string;
  awayEntryId: string;
};

export type ResultPatch = {
  status: MatchStatus;
  outcomeType: OutcomeType;
  resultState: ResultState;
  homeGoals: number | null;
  awayGoals: number | null;
  htHomeGoals: number | null;
  htAwayGoals: number | null;
  aetHomeGoals: number | null;
  aetAwayGoals: number | null;
  penHome: number | null;
  penAway: number | null;
  winnerEntryId: string | null;
  notes: string | null;
};

export type ResultErrors = Partial<Record<"score" | "halfTime" | "extraTime" | "penalties" | "walkover" | "form", string>>;

const EMPTY_SCORES = {
  homeGoals: null,
  awayGoals: null,
  htHomeGoals: null,
  htAwayGoals: null,
  aetHomeGoals: null,
  aetAwayGoals: null,
  penHome: null,
  penAway: null,
  winnerEntryId: null,
} as const;

type Pair = [number, number] | null;
function pair(a: number | null | undefined, b: number | null | undefined, label: string, errors: ResultErrors, key: keyof ResultErrors): Pair {
  const hasA = a !== null && a !== undefined;
  const hasB = b !== null && b !== undefined;
  if (hasA !== hasB) {
    errors[key] = `Enter both ${label} scores, or neither`;
    return null;
  }
  return hasA && hasB ? [a, b] : null;
}

export function buildResultPatch(
  input: ResultFormInput,
  ctx: ResultContext,
): { ok: true; patch: ResultPatch } | { ok: false; errors: ResultErrors } {
  const notes = input.notes ?? null;

  // Not played (yet): no score is stored, and nothing counts in the table.
  if (input.status !== "completed") {
    return {
      ok: true,
      patch: { status: input.status, outcomeType: "normal", resultState: "provisional", notes, ...EMPTY_SCORES },
    };
  }

  const resultState: ResultState = input.intent === "confirm" ? "confirmed" : "provisional";
  const errors: ResultErrors = {};
  const { extrasAllowed, winnerRequired } = resultRulesFor(ctx.competitionType, ctx.stage);

  if (input.outcome === "walkover") {
    if (!input.walkoverWinner) return { ok: false, errors: { walkover: "Choose which team gets the walkover" } };
    return {
      ok: true,
      patch: {
        status: "completed",
        outcomeType: "walkover",
        resultState,
        notes,
        ...EMPTY_SCORES,
        winnerEntryId: input.walkoverWinner === "home" ? ctx.homeEntryId : ctx.awayEntryId,
      },
    };
  }

  const ft = pair(input.homeGoals, input.awayGoals, "full-time", errors, "score");
  if (!ft && !errors.score) errors.score = "Enter the full-time score";
  const ht = pair(input.htHome, input.htAway, "half-time", errors, "halfTime");
  const aet = pair(input.aetHome, input.aetAway, "extra-time", errors, "extraTime");
  const pens = pair(input.penHome, input.penAway, "penalty", errors, "penalties");
  if (!ft || Object.keys(errors).length) return { ok: false, errors };

  if (ht && (ht[0] > ft[0] || ht[1] > ft[1])) errors.halfTime = "Half-time goals can't be more than full-time goals";

  if (aet) {
    if (!extrasAllowed) errors.extraTime = "League and group matches don't have extra time";
    else if (ft[0] !== ft[1]) errors.extraTime = "Extra time only follows a draw at full time";
    else if (aet[0] < ft[0] || aet[1] < ft[1]) errors.extraTime = "The score after extra time includes the full-time goals, so it can't be lower";
  }
  const final = aet ?? ft;
  const level = final[0] === final[1];

  if (pens) {
    if (!extrasAllowed) errors.penalties = "League and group matches don't have penalty shootouts";
    else if (!level) errors.penalties = "Penalties only follow a draw";
    else if (pens[0] === pens[1]) errors.penalties = "A shootout can't end level";
  } else if (winnerRequired && level) {
    errors.penalties = "A knockout match needs a winner: enter the penalty shootout";
  }
  if (Object.keys(errors).length) return { ok: false, errors };

  let winnerEntryId: string | null = null;
  if (final[0] !== final[1]) winnerEntryId = final[0] > final[1] ? ctx.homeEntryId : ctx.awayEntryId;
  else if (pens) winnerEntryId = pens[0] > pens[1] ? ctx.homeEntryId : ctx.awayEntryId;

  return {
    ok: true,
    patch: {
      status: "completed",
      outcomeType: input.outcome,
      resultState,
      notes,
      homeGoals: ft[0],
      awayGoals: ft[1],
      htHomeGoals: ht?.[0] ?? null,
      htAwayGoals: ht?.[1] ?? null,
      aetHomeGoals: aet?.[0] ?? null,
      aetAwayGoals: aet?.[1] ?? null,
      penHome: pens?.[0] ?? null,
      penAway: pens?.[1] ?? null,
      winnerEntryId,
    },
  };
}
