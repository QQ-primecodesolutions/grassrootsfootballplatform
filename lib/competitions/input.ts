import { z } from "zod";
import { safeExternalUrl } from "@/lib/public/links";
import { competitionRulesSchema, TIE_BREAKERS, type CompetitionRules } from "@/lib/rules";

/**
 * Admin setup forms: competitions, rules, team entries and points adjustments (pure, tested).
 * A competition's slug is part of its public URL (`/{org}/{slug}`), so it is fixed once created.
 */

/** Paths under /{org}/ that a competition slug must not shadow. */
export const RESERVED_COMPETITION_SLUGS = new Set(["match", "team", "admin", "graphics"]);

/** Types the admin can create. `group_knockout` needs group tables, which aren't built yet. */
export const CREATABLE_TYPES = ["league", "knockout"] as const;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .default("")
    .transform((v) => v || null);

const checkbox = z
  .union([z.literal("on"), z.literal("true"), z.literal("")])
  .optional()
  .transform((v) => v === "on" || v === "true");

const logoUrl = z
  .string()
  .trim()
  .max(500)
  .default("")
  .transform((v) => v || null)
  .refine((v) => v === null || /^\/brand\/[\w.-]+\.(png|jpe?g|webp|svg)$/i.test(v) || safeExternalUrl(v) !== null, {
    message: "Logo must be a full https:// link",
  });

const facebook = z
  .string()
  .trim()
  .max(500)
  .default("")
  .transform((v) => v || null)
  .refine((v) => v === null || /^https:\/\/(www\.|web\.|m\.)?facebook\.com\//i.test(v), {
    message: "Facebook link must start with https://www.facebook.com/",
  })
  .transform((v) => (v === null ? null : safeExternalUrl(v)));

const settingsFields = {
  name: z.string().trim().min(2, "Enter the competition's name").max(100),
  streamLabel: optionalText(40),
  area: optionalText(60),
  slogan: optionalText(120),
  logoUrl,
  facebook,
  expectedMatchCount: z
    .string()
    .trim()
    .default("")
    .transform((v) => (v === "" ? null : Number(v)))
    .refine((v) => v === null || (Number.isInteger(v) && v > 0 && v <= 2000), {
      message: "Number of matches must be a whole number above 0 (or empty)",
    }),
  isFeatured: checkbox,
};

export const competitionCreateSchema = z.object({
  ...settingsFields,
  type: z.enum(CREATABLE_TYPES, { error: "Choose league or knockout" }),
  season: z.string().trim().min(2, "Enter the season, e.g. 2026").max(30),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2, "The link name needs at least 2 characters")
    .max(60, "Keep the link name under 60 characters")
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use only letters, numbers and single dashes")
    .refine((s) => !RESERVED_COMPETITION_SLUGS.has(s), "That link name is reserved. Pick another."),
});

export const competitionUpdateSchema = z.object(settingsFields);

export type CompetitionCreateInput = z.infer<typeof competitionCreateSchema>;
export type CompetitionUpdateInput = z.infer<typeof competitionUpdateSchema>;

const whole = (label: string, max = 20) =>
  z
    .string()
    .trim()
    .regex(/^\d+$/, `${label} must be a whole number`)
    .transform(Number)
    .refine((n) => n <= max, `${label} must be ${max} or less`);

/**
 * The rules form: points, tie-breakers 2–5 as dropdowns ("" = none; points always first),
 * walkover score, and whether the organiser has confirmed them.
 */
export const rulesFormSchema = z
  .object({
    win: whole("Points for a win"),
    draw: whole("Points for a draw"),
    loss: whole("Points for a loss"),
    tb1: z.string().default(""),
    tb2: z.string().default(""),
    tb3: z.string().default(""),
    tb4: z.string().default(""),
    walkoverFor: whole("Walkover goals", 30),
    walkoverAgainst: whole("Walkover goals", 30),
    walkoverCountGoals: checkbox,
    confirmed: checkbox,
  })
  .transform((f, ctx): CompetitionRules => {
    const picked = [f.tb1, f.tb2, f.tb3, f.tb4].filter(Boolean);
    const parsed = competitionRulesSchema.safeParse({
      points: { win: f.win, draw: f.draw, loss: f.loss },
      tieBreakers: ["points", ...picked],
      walkover: { score: [f.walkoverFor, f.walkoverAgainst], countGoals: f.walkoverCountGoals },
      confirmed: f.confirmed,
    });
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const message =
        issue?.path[0] === "tieBreakers"
          ? picked.some((t) => !(TIE_BREAKERS as readonly string[]).includes(t))
            ? "Unknown tie-breaker"
            : "Each tie-breaker can only be used once"
          : issue?.path[0] === "walkover"
            ? "The walkover score must favour the winner, e.g. 3–0"
            : (issue?.message ?? "Check the rules");
      ctx.addIssue({ code: "custom", message });
      return z.NEVER;
    }
    if (f.win < f.draw || f.draw < f.loss) {
      ctx.addIssue({ code: "custom", message: "A win must be worth at least a draw, and a draw at least a loss" });
      return z.NEVER;
    }
    return parsed.data;
  });

/** "Passion FC\nSamba Boys, Tseki Galaxy" → unique, trimmed names (one per line or comma). */
export function parseTeamNames(input: string): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const raw of input.split(/[\n,;]+/)) {
    const name = raw.replace(/^\s*(\d+[.)]\s*|[-*•]\s*)/, "").replace(/\s+/g, " ").trim();
    const key = name.toLowerCase();
    if (name.length >= 2 && !seen.has(key)) {
      seen.add(key);
      names.push(name.slice(0, 80));
    }
  }
  return names;
}

/** A short name for graphics: the full name if it fits, else cut at a word boundary. */
export function defaultShortName(name: string, max = 24): string {
  if (name.length <= max) return name;
  const cut = name.slice(0, max + 1);
  const space = cut.lastIndexOf(" ");
  return (space > 3 ? cut.slice(0, space) : name.slice(0, max)).trim();
}

export const adjustmentSchema = z.object({
  entryId: z.uuid({ error: "Choose a team" }),
  points: z
    .string()
    .trim()
    .regex(/^[+-]?\d+$/, "Points must be a whole number, e.g. -3 or 2")
    .transform(Number)
    .refine((n) => n !== 0 && Math.abs(n) <= 100, "Points must be between -100 and 100, and not 0"),
  reason: z.string().trim().min(3, "Give the reason, as the organiser announced it").max(200),
  effectiveOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose the date it applies from"),
});

export type AdjustmentInput = z.infer<typeof adjustmentSchema>;
