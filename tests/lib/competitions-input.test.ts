import { describe, expect, it } from "vitest";
import {
  adjustmentSchema,
  competitionCreateSchema,
  defaultShortName,
  parseTeamNames,
  rulesFormSchema,
} from "@/lib/competitions/input";
import { DEFAULT_RULES, describeRules } from "@/lib/rules";

const base = {
  name: "Top 4 Cup",
  type: "knockout",
  season: "2026",
  slug: "Top-4-Cup-2026",
  streamLabel: "",
  area: "",
  slogan: "",
  logoUrl: "",
  facebook: "",
  expectedMatchCount: "",
};

describe("competition form", () => {
  it("normalises a new competition", () => {
    expect(competitionCreateSchema.parse(base)).toMatchObject({
      name: "Top 4 Cup",
      type: "knockout",
      slug: "top-4-cup-2026",
      streamLabel: null,
      expectedMatchCount: null,
      isFeatured: false,
      facebook: null,
    });
    expect(competitionCreateSchema.parse({ ...base, type: "league", expectedMatchCount: "30", isFeatured: "on" })).toMatchObject({
      expectedMatchCount: 30,
      isFeatured: true,
    });
  });

  it("rejects bad input", () => {
    for (const bad of [
      { slug: "match" },
      { slug: "team" },
      { slug: "a b" },
      { type: "group_knockout" },
      { expectedMatchCount: "0" },
      { expectedMatchCount: "2.5" },
      { season: "" },
      { logoUrl: "javascript:alert(1)" },
    ]) {
      expect(competitionCreateSchema.safeParse({ ...base, ...bad }).success, JSON.stringify(bad)).toBe(false);
    }
  });
});

describe("rules form", () => {
  const form = {
    win: "3",
    draw: "1",
    loss: "0",
    tb1: "goalDifference",
    tb2: "goalsFor",
    tb3: "headToHead",
    tb4: "",
    walkoverFor: "3",
    walkoverAgainst: "0",
    walkoverCountGoals: "on",
  };

  it("builds rules with points first and skips empty tie-breakers", () => {
    expect(rulesFormSchema.parse(form)).toEqual({ ...DEFAULT_RULES, confirmed: false });
    expect(rulesFormSchema.parse({ ...form, tb1: "headToHead", tb2: "", tb3: "goalDifference", confirmed: "on" })).toMatchObject({
      tieBreakers: ["points", "headToHead", "goalDifference"],
      walkover: { score: [3, 0], countGoals: true },
      confirmed: true,
    });
    expect(rulesFormSchema.parse({ ...form, walkoverCountGoals: undefined }).walkover.countGoals).toBe(false);
  });

  it("rejects repeated tie-breakers, impossible points and a walkover that favours the loser", () => {
    expect(rulesFormSchema.safeParse({ ...form, tb2: "goalDifference" }).error?.issues[0]?.message).toMatch(/only be used once/);
    expect(rulesFormSchema.safeParse({ ...form, tb4: "points" }).success).toBe(false);
    expect(rulesFormSchema.safeParse({ ...form, tb4: "coinToss" }).error?.issues[0]?.message).toMatch(/Unknown/);
    expect(rulesFormSchema.safeParse({ ...form, win: "1", draw: "3" }).success).toBe(false);
    expect(rulesFormSchema.safeParse({ ...form, walkoverFor: "0", walkoverAgainst: "3" }).error?.issues[0]?.message).toMatch(
      /favour the winner/,
    );
    expect(rulesFormSchema.safeParse({ ...form, win: "-3" }).success).toBe(false);
  });

  it("describes rules in plain language", () => {
    const lines = describeRules(DEFAULT_RULES);
    expect(lines[0]).toBe("Points: 3 for a win, 1 for a draw, 0 for a loss.");
    expect(lines[1]).toBe("Teams level on points are separated by: goal difference, goals scored, head-to-head.");
    expect(lines.some((l) => l.startsWith("Head-to-head uses a mini-table"))).toBe(true);
  });
});

describe("team list paste", () => {
  it("splits lines and commas, strips numbering and bullets, and drops duplicates", () => {
    expect(parseTeamNames("1. Passion FC\n2) Samba Boys\n• Tseki  Galaxy\n- passion fc\n\nX\nLere La Tshepe, Remember Matoota")).toEqual([
      "Passion FC",
      "Samba Boys",
      "Tseki Galaxy",
      "Lere La Tshepe",
      "Remember Matoota",
    ]);
  });

  it("makes short names that fit graphics", () => {
    expect(defaultShortName("Passion FC")).toBe("Passion FC");
    expect(defaultShortName("Phuthaditjhaba Young Stars Football Club")).toBe("Phuthaditjhaba Young");
    expect(defaultShortName("A".repeat(30))).toHaveLength(24);
  });
});

describe("points adjustment", () => {
  const entryId = "5d1e8a2b-7f3c-4b6d-8e9f-0a1b2c3d4e5f";
  it("accepts signed whole numbers, never zero", () => {
    expect(adjustmentSchema.parse({ entryId, points: "-3", reason: "Fielded an ineligible player", effectiveOn: "2026-10-01" }).points).toBe(-3);
    expect(adjustmentSchema.parse({ entryId, points: "+2", reason: "Awarded", effectiveOn: "2026-10-01" }).points).toBe(2);
    expect(adjustmentSchema.safeParse({ entryId, points: "0", reason: "None", effectiveOn: "2026-10-01" }).success).toBe(false);
    expect(adjustmentSchema.safeParse({ entryId, points: "-3", reason: "", effectiveOn: "2026-10-01" }).success).toBe(false);
  });
});
