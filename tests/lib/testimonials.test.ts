import { describe, expect, it } from "vitest";
import { publishedTestimonials, TESTIMONIALS } from "@/lib/testimonials";

describe("homepage quotes", () => {
  it("never shows a quote the organisation hasn't approved", () => {
    expect(publishedTestimonials([{ quote: "Draft", name: "X", role: "Organiser", approved: false }])).toEqual([]);
    expect(publishedTestimonials([{ quote: "OK", name: "Y", role: "League", approved: true }])).toHaveLength(1);
  });

  it("ships the Batho Pele and QDL drafts unpublished until they approve them", () => {
    expect(TESTIMONIALS.map((t) => t.name)).toEqual(["Batho Pele Kasi Soccer Tournament", "QwaQwa Development League"]);
    expect(publishedTestimonials()).toEqual([]);
  });
});
