import { z } from "zod";

/**
 * Competition rules. Every default here is an ASSUMPTION until the organiser
 * confirms it; the admin competition settings must say so (see RULE_ASSUMPTIONS).
 */

export const TIE_BREAKERS = ["points", "goalDifference", "goalsFor", "wins", "headToHead"] as const;
export type TieBreaker = (typeof TIE_BREAKERS)[number];

const nonNegativeInt = z.number().int().min(0);

export const competitionRulesSchema = z.object({
  points: z
    .object({
      win: nonNegativeInt.default(3),
      draw: nonNegativeInt.default(1),
      loss: nonNegativeInt.default(0),
    })
    .prefault({}),
  tieBreakers: z
    .array(z.enum(TIE_BREAKERS))
    .min(1)
    .refine((list) => list[0] === "points", { message: "The first tie-breaker must be points" })
    .refine((list) => new Set(list).size === list.length, { message: "Tie-breakers must not repeat" })
    .default(["points", "goalDifference", "goalsFor", "headToHead"]),
  walkover: z
    .object({
      score: z.tuple([nonNegativeInt, nonNegativeInt]).default([3, 0]),
      countGoals: z.boolean().default(true),
    })
    .refine((w) => w.score[0] > w.score[1], {
      message: "The walkover score must favour the winner (e.g. [3, 0])",
      path: ["score"],
    })
    .prefault({}),
});

export type CompetitionRules = z.infer<typeof competitionRulesSchema>;

/** Parse stored/entered rules, filling defaults. Throws on invalid input. */
export function parseRules(input: unknown): CompetitionRules {
  return competitionRulesSchema.parse(input ?? {});
}

export const DEFAULT_RULES: CompetitionRules = parseRules({});

/** Shown in the admin rules banner until the organiser confirms. */
export const RULE_ASSUMPTIONS = [
  "Points: 3 for a win, 1 for a draw, 0 for a loss.",
  "Tie-breaker order is NOT yet confirmed by the organiser. Until it is, the default is: points, goal difference, goals scored, head-to-head.",
  "Head-to-head uses a mini-table of matches between the tied teams only (points, then goal difference, then goals scored). Teams still level continue down the tie-breaker list.",
  "Teams level after every tie-breaker share the same position.",
  "A walkover counts as a 3–0 win, and those goals count.",
  "Stream A is a double round-robin (10 rounds).",
] as const;
