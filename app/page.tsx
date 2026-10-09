import Image from "next/image";
import { LatestResults } from "@/components/public/LatestResults";
import { OrgDirectory, type DirectoryOrg } from "@/components/public/OrgDirectory";
import { PlatformCredit } from "@/components/public/PlatformCredit";
import { listLatestResults, listOrganisations } from "@/lib/db/queries";
import { CONTACT_WHATSAPP, whatsappChatUrl } from "@/lib/contact";
import { publicEnv } from "@/lib/env";
import { HERO_PHOTOS } from "@/lib/home";
import { publishedTestimonials } from "@/lib/testimonials";

const FEATURES = [
  { title: "Live tables", text: "Calculated from confirmed results only, so the log is always right." },
  { title: "Fixtures & results", text: "Every match day on your phone, light on data." },
  { title: "Share in seconds", text: "Ready-made graphics for WhatsApp and Facebook." },
] as const;

export default async function HomePage() {
  const app = publicEnv.NEXT_PUBLIC_APP_NAME;
  const [organisations, latest] = await Promise.all([listOrganisations(), listLatestResults(6)]);
  const testimonials = publishedTestimonials();
  const slides = HERO_PHOTOS.length;
  const orgs: DirectoryOrg[] = organisations.map((o) => ({
    id: o.id,
    slug: o.slug,
    name: o.name,
    shortName: o.shortName,
    tagline: o.tagline,
    logoUrl: o.logoUrl,
    primaryColor: o.primaryColor,
  }));

  return (
    <div className="flex min-h-full flex-1 flex-col bg-page">
      <header className="relative isolate overflow-hidden bg-emerald-950 text-white">
        {/* The first photo always shows; the others fade in over it in turn (7 s each). */}
        {HERO_PHOTOS.map((photo, i) => (
          <Image
            key={photo.alt}
            src={photo.src}
            alt={i === 0 ? photo.alt : ""}
            fill
            priority={i === 0}
            sizes="100vw"
            placeholder={i === 0 ? "blur" : "empty"}
            className={`-z-10 object-cover ${i > 0 ? "hero-slide" : ""}`}
            style={{
              objectPosition: photo.position,
              ...(i > 0 && slides <= 3
                ? { animationName: `hero-slide-${slides}`, animationDuration: `${slides * 7}s`, animationDelay: `${i * 7}s` }
                : {}),
            }}
          />
        ))}
        {/* Darken the photo so the text stays readable on any screen. */}
        <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-b from-black/50 via-black/15 to-emerald-950/80" />
        <div className="mx-auto max-w-3xl px-4 pb-16 pt-10 sm:pb-20 sm:pt-16">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-200">Community football</p>
          <h1 className="mt-2 font-display text-5xl font-bold uppercase leading-none tracking-wide drop-shadow sm:text-6xl">{app}</h1>
          <p className="mt-3 max-w-md text-lg leading-snug text-white/90 drop-shadow">
            League tables, fixtures and results for kasi and community football, from QwaQwa and beyond.
          </p>
        </div>
      </header>

      <main className="flex-1 pb-10">
        <OrgDirectory orgs={orgs} searchPlaceholder="Search leagues and organisers…" />

        <LatestResults results={latest} />

        <section aria-label="What you get" className="mx-auto mt-10 grid max-w-3xl grid-cols-1 gap-3 px-4 sm:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/5">
              <h2 className="font-display text-lg font-bold uppercase tracking-wide text-emerald-900">{f.title}</h2>
              <p className="mt-1 text-sm text-muted">{f.text}</p>
            </div>
          ))}
        </section>

        {testimonials.length ? (
          <section aria-label="What organisers say" className="mx-auto mt-10 grid max-w-3xl grid-cols-1 gap-3 px-4 sm:grid-cols-2">
            {testimonials.map((t) => (
              <figure key={t.name} className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-black/5">
                <blockquote className="text-lg leading-snug">“{t.quote}”</blockquote>
                <figcaption className="mt-3 text-sm">
                  <span className="font-semibold">{t.name}</span>
                  <span className="text-muted"> · {t.role}</span>
                </figcaption>
              </figure>
            ))}
          </section>
        ) : null}

        <section className="mx-auto mt-6 max-w-3xl px-4">
          <div className="rounded-xl bg-emerald-900 p-5 text-white">
            <h2 className="font-display text-2xl font-bold uppercase tracking-wide">Run a league or tournament?</h2>
            <p className="mt-1 text-white/85">Put your tables, fixtures and results online, and share them in seconds.</p>
            <a
              href={whatsappChatUrl(CONTACT_WHATSAPP, `Hi PrimeCode Solutions, I run a league or tournament and would like to put it on ${app}.`)}
              target="_blank"
              rel="noopener"
              className="mt-4 inline-flex h-12 items-center gap-2 rounded-lg bg-[#25D366] px-5 font-semibold text-emerald-950"
            >
              <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5">
                <path
                  fill="currentColor"
                  d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.1 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.6 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z"
                />
              </svg>
              WhatsApp
            </a>
          </div>
        </section>
      </main>

      <footer className="bg-emerald-950 px-4 py-6 text-center text-sm text-white/80">
        <PlatformCredit />
      </footer>
    </div>
  );
}
