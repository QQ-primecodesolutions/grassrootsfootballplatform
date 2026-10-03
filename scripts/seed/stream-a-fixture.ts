import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import type { SeedResult } from "./data/batho-pele-stream-a";

/**
 * tests/fixtures/stream-a-results.json: the full Stream A results transcribed
 * from the organiser's posts. Used by the reconciliation test and by
 * `pnpm db:seed:stream-a-results` (which refuses to load it while unverified, and loads
 * results marked `pending` as provisional).
 */

export const STREAM_A_FIXTURE_PATH = "tests/fixtures/stream-a-results.json";

const resultSchema = z.object({
  round: z.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  home: z.string().min(1),
  away: z.string().min(1),
  homeGoals: z.number().int().min(0),
  awayGoals: z.number().int().min(0),
  venue: z.string().min(1).optional(),
  outcome: z.enum(["normal", "awarded"]).optional(),
  notes: z.string().optional(),
  /** Not yet confirmed by the organiser: loaded as provisional, so it stays private and doesn't count. */
  pending: z.boolean().optional(),
  source: z.string().optional(),
});

export const streamAFixtureSchema = z.object({
  competition: z.string(),
  organisation: z.string(),
  unverified: z.boolean(),
  note: z.string().optional(),
  results: z.array(resultSchema).min(1),
});

export type StreamAFixture = z.infer<typeof streamAFixtureSchema>;

export function loadStreamAFixture(path = STREAM_A_FIXTURE_PATH): StreamAFixture {
  const raw: unknown = JSON.parse(readFileSync(resolve(process.cwd(), path), "utf8"));
  return streamAFixtureSchema.parse(raw);
}

export function fixtureToSeedResults(fixture: StreamAFixture): SeedResult[] {
  return fixture.results.map(({ source: _source, ...r }) => r);
}
