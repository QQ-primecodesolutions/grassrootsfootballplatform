"use server";

import { refresh, updateTag } from "next/cache";
import { z } from "zod";
import { getCurrentAdmin } from "@/lib/auth";
import { competitionTag, orgTag, teamTag } from "@/lib/cache/tags";
import { ensureVenue, insertFixtures, listCompetitionsForAdmin, type NewFixture } from "@/lib/db/queries/admin";
import type { OrgScope } from "@/lib/db/queries";
import { sastDateTime } from "@/lib/time";

export type FixtureFormState = {
  ok: boolean;
  message: string | null;
  nonce: number;
  /** After saving: the page to share that day's fixtures graphic. */
  shareHref?: string;
};

const shareHrefFor = (competitionId: string, date: string) => `/admin/share/fixtures/${competitionId}?date=${date}`;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : null));

const common = {
  competitionId: z.uuid({ error: "Choose a competition" }),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date"),
  time: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Time must look like 14:00")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  venueId: z.uuid().optional().or(z.literal("").transform(() => undefined)),
  newVenue: optionalText(80),
  roundLabel: optionalText(40),
};

const roundNumberOf = (label: string | null) => {
  const m = label?.match(/(\d+)/);
  return m ? Number(m[1]) : null;
};

/** Resolve the competition and its entries within the admin's organisation. */
async function loadCompetition(scope: OrgScope, competitionId: string) {
  const competitions = await listCompetitionsForAdmin(scope);
  return competitions.find((c) => c.id === competitionId) ?? null;
}

async function resolveVenue(scope: OrgScope, venueId: string | undefined, newVenue: string | null) {
  if (newVenue) return ensureVenue(scope, newVenue);
  return venueId ?? null;
}

function invalidate(scope: OrgScope, competitionId: string, teamIds: string[]) {
  for (const tag of [orgTag(scope.id), competitionTag(competitionId), ...teamIds.map(teamTag)]) updateTag(tag);
  refresh();
}

// ---------------------------------------------------------------------------
// Single fixture ("add another" keeps competition, date, time and venue)
// ---------------------------------------------------------------------------

const fixtureSchema = z
  .object({
    ...common,
    homeEntryId: z.uuid({ error: "Choose the home team" }),
    awayEntryId: z.uuid({ error: "Choose the away team" }),
  })
  .refine((f) => f.homeEntryId !== f.awayEntryId, { message: "A team can't play itself", path: ["awayEntryId"] });

export async function createFixture(prev: FixtureFormState, formData: FormData): Promise<FixtureFormState> {
  const { scope } = await getCurrentAdmin();
  const nonce = prev.nonce + 1;
  const parsed = fixtureSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the form", nonce };
  const f = parsed.data;

  const competition = await loadCompetition(scope, f.competitionId);
  if (!competition) return { ok: false, message: "Competition not found", nonce };
  const home = competition.entries.find((e) => e.entryId === f.homeEntryId);
  const away = competition.entries.find((e) => e.entryId === f.awayEntryId);
  if (!home || !away) return { ok: false, message: "Both teams must be entered in this competition", nonce };

  const venueId = await resolveVenue(scope, f.venueId, f.newVenue);
  const fixture: NewFixture = {
    homeEntryId: home.entryId,
    awayEntryId: away.entryId,
    kickoffAt: sastDateTime(f.date, f.time ?? "00:00"),
    kickoffTimeTbc: !f.time,
    venueId,
    roundLabel: f.roundLabel,
    roundNumber: roundNumberOf(f.roundLabel),
  };
  const result = await insertFixtures(scope, competition.id, [fixture]);
  if (result.inserted.length === 0) {
    return { ok: false, message: `${home.name} v ${away.name} is already on that date.`, nonce };
  }
  invalidate(scope, competition.id, [home.teamId, away.teamId]);
  return {
    ok: true,
    message: `Added ${home.name} v ${away.name}. Add another?`,
    nonce,
    shareHref: shareHrefFor(competition.id, f.date),
  };
}

// ---------------------------------------------------------------------------
// Bulk paste (preview happens in the browser; the server re-validates everything)
// ---------------------------------------------------------------------------

const pasteSchema = z.object({
  ...common,
  fixtures: z
    .array(
      z.object({
        homeEntryId: z.uuid(),
        awayEntryId: z.uuid(),
        time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),
      }),
    )
    .min(1, "There are no fixtures to save")
    .max(60, "That's a lot of fixtures. Paste at most 60 at a time"),
  aliases: z.array(z.object({ teamId: z.uuid(), alias: z.string().trim().min(1).max(80) })).max(60),
});

export async function savePastedFixtures(prev: FixtureFormState, formData: FormData): Promise<FixtureFormState> {
  const { scope } = await getCurrentAdmin();
  const nonce = prev.nonce + 1;
  let payload: unknown;
  try {
    payload = JSON.parse(String(formData.get("payload") ?? ""));
  } catch {
    return { ok: false, message: "Something went wrong reading the preview. Please try again.", nonce };
  }
  const parsed = pasteSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the fixtures", nonce };
  const p = parsed.data;

  const competition = await loadCompetition(scope, p.competitionId);
  if (!competition) return { ok: false, message: "Competition not found", nonce };
  const entries = new Map(competition.entries.map((e) => [e.entryId, e]));
  const teamIds = new Set(competition.entries.map((e) => e.teamId));
  for (const f of p.fixtures) {
    if (!entries.has(f.homeEntryId) || !entries.has(f.awayEntryId)) {
      return { ok: false, message: "Every team must be entered in this competition", nonce };
    }
    if (f.homeEntryId === f.awayEntryId) return { ok: false, message: "A team can't play itself", nonce };
  }
  if (p.aliases.some((a) => !teamIds.has(a.teamId))) return { ok: false, message: "Unknown team for an alias", nonce };

  const venueId = await resolveVenue(scope, p.venueId, p.newVenue);
  const fixtures: NewFixture[] = p.fixtures.map((f) => {
    const time = f.time ?? p.time;
    return {
      homeEntryId: f.homeEntryId,
      awayEntryId: f.awayEntryId,
      kickoffAt: sastDateTime(p.date, time ?? "00:00"),
      kickoffTimeTbc: !time,
      venueId,
      roundLabel: p.roundLabel,
      roundNumber: roundNumberOf(p.roundLabel),
    };
  });

  const result = await insertFixtures(scope, competition.id, fixtures, p.aliases);
  const touched = [...new Set(p.fixtures.flatMap((f) => [entries.get(f.homeEntryId)!.teamId, entries.get(f.awayEntryId)!.teamId]))];
  invalidate(scope, competition.id, touched);

  const parts = [`Saved ${result.inserted.length} fixture${result.inserted.length === 1 ? "" : "s"}`];
  if (result.skipped) parts.push(`${result.skipped} already existed and ${result.skipped === 1 ? "was" : "were"} skipped`);
  if (p.aliases.length) parts.push(`learned ${p.aliases.length} new name${p.aliases.length === 1 ? "" : "s"}`);
  return {
    ok: true,
    message: `${parts.join(", ")}.`,
    nonce,
    shareHref: result.inserted.length ? shareHrefFor(competition.id, p.date) : undefined,
  };
}
