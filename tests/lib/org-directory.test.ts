import { describe, expect, it } from "vitest";
import { matchesQuery, type DirectoryOrg } from "@/components/public/OrgDirectory";
import type { CompetitionSummary } from "@/lib/db/queries";
import { directoryCard } from "@/lib/public/directory";

const org: DirectoryOrg = {
  id: "1",
  slug: "batho-pele",
  title: "Batho Pele Kasi Soccer Tournament",
  runBy: null,
  tagline: "QwaQwa Development League Open",
  logoUrl: null,
  primaryColor: "#1F7A3F",
  searchText: "Batho Pele",
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

describe("homepage cards", () => {
  const bathoPele = {
    id: "o1",
    slug: "batho-pele",
    name: "Batho Pele Kasi Soccer Tournament",
    shortName: "Batho Pele",
    logoUrl: "/brand/batho-pele.png",
    primaryColor: "#0B3D0B",
    secondaryColor: "#1F7A3F",
    accentColor: null,
    textColor: "#111111",
    backgroundColor: "#F4F4F2",
    tagline: "ONE GAME. ONE PASSION. ONE LEAGUE.",
    hashtags: [],
    socialLinks: {},
  };
  const competition = (over: Partial<CompetitionSummary>): CompetitionSummary => ({
    id: "c1",
    slug: "qdl-open-stream-a-2026",
    name: "QwaQwa Development League Open",
    type: "league",
    streamLabel: "Stream A",
    area: "Tseki",
    slogan: "It's time to shine",
    logoUrl: "/brand/qdl.png",
    socialLinks: {},
    isFeatured: true,
    seasonName: "2026",
    ...over,
  });

  it("leads with the featured competition's brand when it has its own logo", () => {
    const card = directoryCard(bathoPele, [competition({})]);
    expect(card).toMatchObject({
      slug: "batho-pele",
      title: "QwaQwa Development League Open",
      runBy: "Batho Pele Kasi Soccer Tournament",
      logoUrl: "/brand/qdl.png",
      tagline: "It's time to shine",
    });
    expect(matchesQuery(card, "batho pele")).toBe(true);
    expect(matchesQuery(card, "qwaqwa development")).toBe(true);
  });

  it("shows the organisation itself otherwise", () => {
    const card = directoryCard(bathoPele, [competition({ logoUrl: null })]);
    expect(card).toMatchObject({ title: "Batho Pele Kasi Soccer Tournament", runBy: null, logoUrl: "/brand/batho-pele.png" });
    expect(directoryCard(bathoPele, []).title).toBe("Batho Pele Kasi Soccer Tournament");
  });
});
