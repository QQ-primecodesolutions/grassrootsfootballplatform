import { describe, expect, it } from "vitest";
import { competitionUpdateSchema } from "@/lib/competitions/input";
import { isAcceptedLogoValue, mediaPath, parseMediaFile, parseMediaPath, sniffImageType } from "@/lib/media/image";
import { organisationCreateSchema } from "@/lib/platform/organisation-input";

const ID = "5d1e8a2b-7f3c-4b6d-8e9f-0a1b2c3d4e5f";
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0]);

describe("uploaded images", () => {
  it("recognises PNG and JPEG by their bytes, and nothing else", () => {
    expect(sniffImageType(PNG)).toBe("image/png");
    expect(sniffImageType(JPEG)).toBe("image/jpeg");
    expect(sniffImageType(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>'))).toBeNull();
    expect(sniffImageType(new TextEncoder().encode("GIF89a"))).toBeNull();
    expect(sniffImageType(new Uint8Array())).toBeNull();
  });

  it("builds and parses public paths", () => {
    const path = mediaPath("batho-pele", ID, "image/png");
    expect(path).toBe(`/media/batho-pele/${ID}.png`);
    expect(parseMediaPath(path)).toEqual({ orgSlug: "batho-pele", id: ID, ext: "png" });
    expect(parseMediaFile(`${ID}.jpg`)).toEqual({ id: ID, ext: "jpg" });
    for (const bad of [`/media/batho-pele/${ID}.svg`, `/media/../x/${ID}.png`, `/media/batho-pele/not-an-id.png`, `${ID}.png`]) {
      expect(parseMediaPath(bad), bad).toBeNull();
    }
  });

  it("accepts uploaded, shipped and https logos in the forms, and nothing else", () => {
    expect(isAcceptedLogoValue(`/media/demo/${ID}.jpg`)).toBe(true);
    expect(isAcceptedLogoValue("/brand/qdl.png")).toBe(true);
    expect(isAcceptedLogoValue("https://example.com/logo.png")).toBe(true);
    expect(isAcceptedLogoValue("http://example.com/logo.png")).toBe(false);
    expect(isAcceptedLogoValue("javascript:alert(1)")).toBe(false);
    expect(isAcceptedLogoValue("/admin")).toBe(false);
    expect(competitionUpdateSchema.parse({ name: "Cup", logoUrl: `/media/demo/${ID}.png` }).logoUrl).toBe(`/media/demo/${ID}.png`);
  });

  it("reserves 'media' as an organisation link name", () => {
    const base = { name: "Media FC", slug: "media", shortName: "", tagline: "", primaryColor: "#123456", secondaryColor: "#654321", facebook: "" };
    expect(organisationCreateSchema.safeParse(base).success).toBe(false);
    expect(organisationCreateSchema.safeParse({ ...base, slug: "media-fc" }).success).toBe(true);
  });
});
