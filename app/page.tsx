import Image from "next/image";
import { OrgDirectory, type DirectoryOrg } from "@/components/public/OrgDirectory";
import { PlatformCredit } from "@/components/public/PlatformCredit";
import { listOrganisations } from "@/lib/db/queries";
import { publicEnv } from "@/lib/env";
import qwaqwa from "@/public/home/qwaqwa.jpg";

const FEATURES = [
  { title: "Live tables", text: "Calculated from confirmed results only, so the log is always right." },
  { title: "Fixtures & results", text: "Every match day on your phone, light on data." },
  { title: "Share in seconds", text: "Ready-made graphics for WhatsApp and Facebook." },
] as const;

export default async function HomePage() {
  const app = publicEnv.NEXT_PUBLIC_APP_NAME;
  const orgs: DirectoryOrg[] = (await listOrganisations()).map((o) => ({
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
        <Image
          src={qwaqwa}
          alt="The Maluti mountains above QwaQwa"
          fill
          priority
          sizes="100vw"
          placeholder="blur"
          className="-z-10 object-cover object-[center_40%]"
        />
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

        <section aria-label="What you get" className="mx-auto mt-10 grid max-w-3xl grid-cols-1 gap-3 px-4 sm:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/5">
              <h2 className="font-display text-lg font-bold uppercase tracking-wide text-emerald-900">{f.title}</h2>
              <p className="mt-1 text-sm text-muted">{f.text}</p>
            </div>
          ))}
        </section>

        <section className="mx-auto mt-6 max-w-3xl px-4">
          <div className="rounded-xl bg-emerald-900 p-5 text-white">
            <h2 className="font-display text-2xl font-bold uppercase tracking-wide">Run a league or tournament?</h2>
            <p className="mt-1 text-white/85">Put your tables, fixtures and results online, and share them in seconds.</p>
            <a
              href="https://primecodesolutions.co.za"
              target="_blank"
              rel="noopener"
              className="mt-4 inline-flex h-12 items-center rounded-lg bg-white px-5 font-semibold text-emerald-950"
            >
              Get in touch
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
