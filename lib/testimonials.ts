/*
 * Organiser quotes for the homepage. Never publish words in an organisation's name until that
 * organisation has approved them: set `approved: true` only after they agree (they may reword
 * the draft first). Drafts are never shown.
 */

export type Testimonial = {
  quote: string;
  name: string;
  /** e.g. "Organiser". */
  role: string;
  /** Approved by the organisation for publication. Drafts are never shown. */
  approved: boolean;
};

export const TESTIMONIALS: Testimonial[] = [
  {
    quote:
      "Our log used to live in screenshots and WhatsApp messages. Now every result is in one place, and teams see the table as soon as a match is confirmed.",
    name: "Batho Pele Kasi Soccer Tournament",
    role: "Organiser",
    approved: false,
  },
  {
    quote:
      "Players, parents and supporters finally have one place to follow our fixtures and results. It gives the league a proper home.",
    name: "QwaQwa Development League",
    role: "League",
    approved: false,
  },
];

export const publishedTestimonials = (list: Testimonial[] = TESTIMONIALS) => list.filter((t) => t.approved);
