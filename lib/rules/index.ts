import { z } from "zod";

/**
 * Competition rules. Every default here is an ASSUMPTION until the organiser
 * confirms it (`confirmed`); the admin screens flag unconfirmed rules (see describeRules).
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
  /** Set by an admin once the organiser has confirmed these rules; until then the UI flags them. */
  confirmed: z.boolean().default(false),
});

export type CompetitionRules = z.infer<typeof competitionRulesSchema>;

/** Parse stored/entered rules, filling defaults. Throws on invalid input. */
export function parseRules(input: unknown): CompetitionRules {
  return competitionRulesSchema.parse(input ?? {});
}

export const DEFAULT_RULES: CompetitionRules = parseRules({});

export const TIE_BREAKER_LABELS: Record<TieBreaker, string> = {
  points: "points",
  goalDifference: "goal difference",
  goalsFor: "goals scored",
  wins: "wins",
  headToHead: "head-to-head",
};

/** Plain-language summary of a competition's rules, for the admin screens. */
export function describeRules(rules: CompetitionRules): string[] {
  const lines = [
    `Points: ${rules.points.win} for a win, ${rules.points.draw} for a draw, ${rules.points.loss} for a loss.`,
    `Teams level on points are separated by: ${rules.tieBreakers.slice(1).map((t) => TIE_BREAKER_LABELS[t]).join(", ") || "nothing (they share the position)"}.`,
    `A walkover counts as a ${rules.walkover.score[0]}–${rules.walkover.score[1]} win${rules.walkover.countGoals ? ", and those goals count" : ", but the goals don't count"}.`,
  ];
  if (rules.tieBreakers.includes("headToHead")) {
    lines.push(
      "Head-to-head uses a mini-table of matches between the tied teams only (points, then goal difference, then goals scored). Teams still level continue down the list.",
    );
  }
  lines.push("Teams level after every tie-breaker share the same position.");
  return lines;
}
