import { describe, expect, it } from "vitest";
import { normalizeTeamName, slugify } from "@/lib/fixtures-paste/normalize";
import { DEFAULT_RULES, parseRules } from "@/lib/rules";
import { formatLongDate, formatTime, sastDateKey, sastDateTime, todaySast } from "@/lib/time";
import { addDays, createRng, roundRobin } from "@/scripts/seed/generate";

describe("time (Africa/Johannesburg)", () => {
  it("builds instants from SAST wall-clock time", () => {
    expect(sastDateTime("2026-08-15", "14:00").toISOString()).toBe("2026-08-15T12:00:00.000Z");
    expect(sastDateTime("2026-08-15").toISOString()).toBe("2026-08-14T22:00:00.000Z");
  });

  it("derives the SAST calendar date, not the UTC one", () => {
    // 23:30 UTC on the 14th is 01:30 SAST on the 15th.
    expect(sastDateKey(new Date("2026-08-14T23:30:00Z"))).toBe("2026-08-15");
    expect(todaySast(new Date("2026-08-14T21:59:00Z"))).toBe("2026-08-14");
  });

  it("formats for display in SAST", () => {
    const d = sastDateTime("2026-08-15", "09:05");
    expect(formatLongDate(d)).toBe("15 August 2026");
    expect(formatTime(d)).toBe("09:05");
  });

  it("rejects malformed input", () => {
    expect(() => sastDateTime("15/08/2026")).toThrow();
    expect(() => sastDateTime("2026-08-15", "25:00")).toThrow();
  });
});

describe("team name normalisation", () => {
  it.each([
    ["Passion FC", "passion"],
    ["Passion F.C.", "passion"],
    ["  Tseki  Jnr   Stars fc ", "tseki jnr stars"],
    ["Lere La Tshepe", "lere la tshepe"],
    ["RE/MAX Maluti", "re max maluti"],
    ["Café United", "cafe united"],
  ])("%s → %s", (input, expected) => {
    expect(normalizeTeamName(input)).toBe(expected);
  });

  it("does not strip 'fc' inside a word", () => {
    expect(normalizeTeamName("Arcfc")).toBe("arcfc");
  });

  it("slugifies display names", () => {
    expect(slugify("Tseki Junior Stars FC")).toBe("tseki-junior-stars-fc");
    expect(slugify("QwaQwa Development League U19 — Stream A")).toBe("qwaqwa-development-league-u19-stream-a");
  });
});

describe("competition rules", () => {
  it("fills defaults (assumptions until the organiser confirms)", () => {
    expect(DEFAULT_RULES).toEqual({
      points: { win: 3, draw: 1, loss: 0 },
      tieBreakers: ["points", "goalDifference", "goalsFor", "headToHead"],
      walkover: { score: [3, 0], countGoals: true },
    });
    expect(parseRules({ points: { draw: 2 } }).points).toEqual({ win: 3, draw: 2, loss: 0 });
  });

  it("rejects invalid rules", () => {
    expect(() => parseRules({ tieBreakers: ["goalDifference", "points"] })).toThrow();
    expect(() => parseRules({ tieBreakers: ["points", "points"] })).toThrow();
    expect(() => parseRules({ tieBreakers: ["points", "name"] })).toThrow();
    expect(() => parseRules({ walkover: { score: [0, 3] } })).toThrow();
    expect(() => parseRules({ points: { win: -1 } })).toThrow();
  });
});

describe("demo generators", () => {
  it("round-robin: every pair meets once per half, home/away swapped in the return leg", () => {
    const rounds = roundRobin(8, { double: true });
    expect(rounds).toHaveLength(14);
    const seen = new Map<string, number>();
    for (const [r, pairs] of rounds.entries()) {
      const teamsInRound = pairs.flat();
      expect(new Set(teamsInRound).size).toBe(8); // everyone plays once per round
      for (const [h, a] of pairs) {
        const key = `${h}-${a}`;
        seen.set(key, (seen.get(key) ?? 0) + 1);
        if (r >= 7) expect(seen.has(`${a}-${h}`)).toBe(true);
      }
    }
    expect(seen.size).toBe(56); // 8 × 7 ordered pairs, each exactly once
    expect([...seen.values()].every((n) => n === 1)).toBe(true);
  });

  it("rng is deterministic", () => {
    const a = createRng(1);
    const b = createRng(1);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it("adds days across month ends", () => {
    expect(addDays("2026-08-29", 7)).toBe("2026-09-05");
  });
});
