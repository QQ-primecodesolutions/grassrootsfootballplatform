import { describe, expect, it } from "vitest";
import { DEFAULT_RULES } from "@/lib/rules";
import { checkTableInvariants, compareWithPublishedTable, type PublishedRow } from "@/lib/standings";
import { PUBLISHED_TABLE_2026_08_15 } from "../fixtures/published-table-2026-08-15";

describe("checkTableInvariants", () => {
  it("passes on Batho Pele's published 15 Aug 2026 table", () => {
    const check = checkTableInvariants(PUBLISHED_TABLE_2026_08_15, DEFAULT_RULES);
    expect(check).toEqual({ ok: true, errors: [] });

    // 21 matches: 15 decisive + 6 draws, 55 goals for and against.
    const sum = (f: (r: PublishedRow) => number) => PUBLISHED_TABLE_2026_08_15.reduce((a, r) => a + f(r), 0);
    expect(sum((r) => r.played) / 2).toBe(21);
    expect(sum((r) => r.won)).toBe(15);
    expect(sum((r) => r.drawn) / 2).toBe(6);
    expect(sum((r) => r.goalsFor)).toBe(55);
    expect(sum((r) => r.goalsAgainst)).toBe(55);
  });

  it("reports each broken invariant", () => {
    const broken = PUBLISHED_TABLE_2026_08_15.map((r) => ({ ...r }));
    broken[0]!.won = 6; // W ≠ L totals, GP ≠ W+D+L, Pts mismatch
    broken[1]!.goalsFor = 14; // GF ≠ GA totals, GD ≠ GF−GA
    broken[2]!.drawn = 2; // odd total draws
    const { ok, errors } = checkTableInvariants(broken, DEFAULT_RULES);
    expect(ok).toBe(false);
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Total wins (16)"),
        expect.stringContaining("Total draws (13) is odd"),
        expect.stringContaining("Total goals for (56)"),
        expect.stringContaining("Tseki Junior Stars FC: GP 7"),
        expect.stringContaining("Remember Matoota FC: GD 4"),
        expect.stringContaining("Tseki Junior Stars FC: Pts 17"),
      ]),
    );
  });
});

describe("compareWithPublishedTable", () => {
  const published = PUBLISHED_TABLE_2026_08_15;

  it("returns no differences for identical tables", () => {
    expect(compareWithPublishedTable(published.map((r) => ({ ...r })), published)).toEqual([]);
  });

  it("matches teams by normalised name", () => {
    const computed = published.map((r) => ({ ...r, name: r.name.replace(/ FC$/, "").toUpperCase() }));
    expect(compareWithPublishedTable(computed, published)).toEqual([]);
  });

  it("lists every differing cell", () => {
    const computed = published.map((r) => ({ ...r }));
    computed[4] = { ...computed[4]!, drawn: 2, lost: 4, points: 5 };
    expect(compareWithPublishedTable(computed, published)).toEqual([
      { team: "Samba Boys FC", column: "drawn", expected: 3, actual: 2 },
      { team: "Samba Boys FC", column: "lost", expected: 3, actual: 4 },
      { team: "Samba Boys FC", column: "points", expected: 6, actual: 5 },
    ]);
  });

  it("reports missing and extra teams", () => {
    const computed = [...published.slice(0, 5), { ...published[5]!, name: "Someone Else FC" }];
    expect(compareWithPublishedTable(computed, published)).toEqual([
      { team: "Tseki Galaxy FC", column: "row", expected: "present", actual: "missing" },
      { team: "Someone Else FC", column: "row", expected: "absent", actual: "present" },
    ]);
  });
});
