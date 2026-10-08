import { z } from "zod";
import { safeExternalUrl } from "@/lib/public/links";

/**
 * The super admin's "new / edit organisation" form (pure, tested).
 * The slug becomes the public URL (`/{slug}`), so it is fixed once created.
 */

/** Top-level paths an organisation slug must not shadow. */
export const RESERVED_SLUGS = new Set([
  "admin",
  "api",
  "graphics",
  "brand",
  "platform",
  "login",
  "static",
  "_next",
  "favicon.ico",
  "robots.txt",
  "sitemap.xml",
]);

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2, "The link name needs at least 2 characters")
  .max(40, "Keep the link name under 40 characters")
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use only letters, numbers and single dashes, e.g. batho-pele")
  .refine((s) => !RESERVED_SLUGS.has(s), "That link name is reserved. Pick another.");

const hex = (label: string) =>
  z
    .string()
    .trim()
    .regex(/^#[0-9A-Fa-f]{6}$/, `${label} must be a colour like #1F7A3F`)
    .transform((v) => v.toUpperCase());

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null);

/** A logo is a file shipped in public/brand or a full https:// link. */
const logoUrl = z
  .string()
  .trim()
  .max(500)
  .transform((v) => v || null)
  .refine((v) => v === null || /^\/brand\/[\w.-]+\.(png|jpe?g|webp|svg)$/i.test(v) || safeExternalUrl(v) !== null, {
    message: "Logo must be a full https:// link (or /brand/… for files in the app)",
  });

const facebook = z
  .string()
  .trim()
  .max(500)
  .transform((v) => v || null)
  .refine((v) => v === null || /^https:\/\/(www\.|web\.|m\.)?facebook\.com\//i.test(v), {
    message: "Facebook link must start with https://www.facebook.com/",
  })
  .transform((v) => (v === null ? null : safeExternalUrl(v)));

/** "#BathoPele, KasiSoccer" → ["#BathoPele", "#KasiSoccer"] */
export function parseHashtags(input: string): string[] {
  const tags = input
    .split(/[\s,]+/)
    .map((t) => t.replace(/^#+/, "").replace(/[^\p{L}\p{N}_]/gu, ""))
    .filter(Boolean)
    .map((t) => `#${t}`);
  return [...new Set(tags)].slice(0, 6);
}

const brandFields = {
  name: z.string().trim().min(2, "Enter the organisation's name").max(100),
  shortName: optionalText(30),
  tagline: optionalText(120),
  primaryColor: hex("Main colour"),
  secondaryColor: hex("Second colour"),
  logoUrl,
  facebook,
  hashtags: z.string().max(200).default("").transform(parseHashtags),
};

export const organisationCreateSchema = z.object({ ...brandFields, slug: slugSchema });
export const organisationUpdateSchema = z.object(brandFields);

export type OrganisationCreateInput = z.infer<typeof organisationCreateSchema>;
export type OrganisationUpdateInput = z.infer<typeof organisationUpdateSchema>;

/** Invite form: the organiser's name and email. */
export const inviteSchema = z.object({
  name: z.string().trim().min(2, "Enter the person's name").max(80),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(200)
    .pipe(z.email("Enter a valid email address")),
});

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}
