import { describe, expect, it } from "vitest";
import { facebookUrl, safeExternalUrl } from "@/lib/public/links";

describe("organiser-supplied links", () => {
  it("normalises Facebook's web. and m. hosts to www.", () => {
    expect(facebookUrl({ facebook: "https://web.facebook.com/profile.php?id=61562688586348" })).toBe(
      "https://www.facebook.com/profile.php?id=61562688586348",
    );
    expect(safeExternalUrl("https://m.facebook.com/profile.php?id=1")).toBe("https://www.facebook.com/profile.php?id=1");
  });

  it("only allows https links", () => {
    expect(safeExternalUrl("javascript:alert(1)")).toBeNull();
    expect(safeExternalUrl("http://example.org")).toBeNull();
    expect(safeExternalUrl("not a url")).toBeNull();
    expect(facebookUrl({})).toBeNull();
    expect(facebookUrl(null)).toBeNull();
  });
});
