import { describe, expect, it } from "vitest";
import { fixtureNameFont, fixtureRowHeight } from "@/lib/graphics/graphics";

describe("fixtures graphic sizing", () => {
  it("gives a short list taller rows instead of leaving a gap", () => {
    expect(fixtureRowHeight(1, 640, "portrait")).toBe(270);
    expect(fixtureRowHeight(2, 640, "portrait")).toBe(220);
    expect(fixtureRowHeight(3, 640, "portrait")).toBe(180);
    expect(fixtureRowHeight(8, 640, "portrait")).toBe(68);
    expect(fixtureRowHeight(1, 420, "square")).toBe(200);
    expect(fixtureRowHeight(6, 420, "square")).toBe(64);
  });

  it("uses one name size that fits every name in the row", () => {
    const widthFor = (font: number) => (1000 - 10 - font * 2.1 - 220) / 2 - 20;
    const big = fixtureNameFont(["Passion FC", "Samba Boys FC"], 270, widthFor);
    expect(big).toBeGreaterThan(60);
    // A long single word must still fit its column, so the size drops for everyone.
    const long = fixtureNameFont(["Passion FC", "Phuthaditjhaba"], 270, widthFor);
    expect(long).toBeLessThan(big);
    expect(long * 0.46 * "PHUTHADITJHABA".length).toBeLessThanOrEqual(widthFor(long) + 1);
    // Small rows keep the old minimum.
    expect(fixtureNameFont(["A Very Long Team Name Indeed United FC"], 64, widthFor)).toBe(24);
  });
});
