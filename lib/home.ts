import type { StaticImageData } from "next/image";
import huddle from "@/public/home/huddle.jpg";
import qwaqwa from "@/public/home/qwaqwa.jpg";

/*
 * Homepage banner photos (quotes are in lib/testimonials.ts).
 *
 * Photos: only pictures where no child can be recognised, or with a parent's/guardian's
 * consent (POPIA). Files in public/ are downloadable even when unused, so a photo goes into
 * public/home/ only once it may be published.
 */

export type HeroPhoto = { src: StaticImageData; alt: string; position: string };

export const HERO_PHOTOS: HeroPhoto[] = [
  { src: qwaqwa, alt: "The Maluti mountains above QwaQwa", position: "center 40%" },
  { src: huddle, alt: "A team in a pre-match huddle on a dusty pitch", position: "center 45%" },
];
