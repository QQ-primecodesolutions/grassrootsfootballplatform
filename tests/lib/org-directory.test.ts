import { describe, expect, it } from "vitest";
import { matchesQuery, type DirectoryOrg } from "@/components/public/OrgDirectory";

const org: DirectoryOrg = {
  id: "1",
  slug: "batho-pele",
  name: "Batho Pele Kasi Soccer Tournament",
  shortName: "Batho Pele",
  tagline: "QwaQwa Development League Open",
  logoUrl: null,
  primaryColor: "#1F7A3F",
};

describe("organisation search", () => {
  it("matches every typed word against the name, short name and tagline, ignoring case", () => {
    expect(matchesQuery(org, "")).toBe(true);
    expect(matchesQuery(org, "batho")).toBe(true);
    expect(matchesQuery(org, "KASI soccer")).toBe(true);
    expect(matchesQuery(org, "qwaqwa  open")).toBe(true);
    expect(matchesQuery(org, "pele maluti")).toBe(false);
  });
});

describe("homepage WhatsApp link", () => {
  it("opens a chat with the South African number in international format and a ready message", async () => {
    const { CONTACT_WHATSAPP, whatsappChatUrl } = await import("@/lib/contact");
    expect(CONTACT_WHATSAPP).toBe("27672092558");
    expect(whatsappChatUrl(CONTACT_WHATSAPP, "Hi there")).toBe("https://wa.me/27672092558?text=Hi%20there");
  });
});
