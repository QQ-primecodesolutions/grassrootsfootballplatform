import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PlatformCredit } from "@/components/public/PlatformCredit";
import { privacyNoticeLive, publicEnv } from "@/lib/env";

/*
 * Privacy notice (POPIA). Drafted from what the platform actually does; the owner reviews the
 * wording. Published only once NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL is set: until then it is a
 * draft visible in development and a 404 in production.
 */

const app = publicEnv.NEXT_PUBLIC_APP_NAME;
const LAST_UPDATED = "10 October 2026";

export const metadata: Metadata = {
  title: "Privacy notice",
  description: `How ${app} handles personal information.`,
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="font-display text-xl font-bold uppercase tracking-wide">{title}</h2>
      <div className="mt-2 space-y-2 leading-relaxed">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  const contact = publicEnv.NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL;
  if (!privacyNoticeLive() && process.env.NODE_ENV === "production") notFound();

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
      {!contact ? (
        <p role="note" className="mb-4 rounded-lg bg-amber-100 px-3 py-2 text-sm font-semibold text-amber-950">
          Draft for review: set NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL to publish this page. It is hidden on the live site until then.
        </p>
      ) : null}
      <Link href="/" className="text-sm font-semibold text-muted underline">
        ← {app}
      </Link>
      <h1 className="mt-2 font-display text-3xl font-bold uppercase tracking-wide">Privacy notice</h1>
      <p className="text-sm text-muted">Last updated {LAST_UPDATED}</p>

      <Section title="Who we are">
        <p>
          {app} publishes league tables, fixtures and results for community football organisations in South Africa. It is
          developed and run by PrimeCode Solutions (“we”). Each football organisation on the platform decides what it publishes
          about its own competitions.
        </p>
      </Section>

      <Section title="What we collect">
        <p>
          <strong>Visitors to the public site</strong> don&apos;t sign in. We don&apos;t use advertising or tracking cookies. Our
          hosting provider keeps standard technical logs (such as IP address, time and page requested) for a short period, for
          security and to keep the site running.
        </p>
        <p>
          <strong>Organisers and scorers who sign in</strong>: we keep your name, email address, a one-way scrambled form of your
          password (we can never see the password itself), when you last signed in, and which results you entered. When a
          sign-in fails, we record the IP address and time for up to 24 hours to block password guessing.
        </p>
        <p>
          <strong>Football information</strong>: team names and logos, fixtures, venues and results. This is information about
          teams, not people. We don&apos;t record players or their personal details.
        </p>
      </Section>

      <Section title="Cookies">
        <p>
          Only people who sign in get one essential cookie, which keeps them signed in for up to 14 days. It isn&apos;t used for
          anything else.
        </p>
      </Section>

      <Section title="Why we use it">
        <p>To run the platform, let organisers and scorers sign in, show who entered a result, and keep accounts secure.</p>
      </Section>

      <Section title="Who we share it with">
        <p>
          We don&apos;t sell personal information. Our hosting and database providers store it on our behalf and may keep it on
          servers outside South Africa, under agreements that require them to protect it. We would only disclose it otherwise if
          the law requires us to.
        </p>
      </Section>

      <Section title="How long we keep it">
        <p>
          Sign-in accounts are kept while you work with an organisation on the platform; ask us and we&apos;ll delete yours.
          Failed sign-in records are deleted after 24 hours. Invite links expire after 7 days and password links after 24 hours.
        </p>
      </Section>

      <Section title="Your rights">
        <p>
          Under the Protection of Personal Information Act (POPIA) you may ask what personal information we hold about you,
          and ask us to correct or delete it.
          {contact ? (
            <>
              {" "}
              Email{" "}
              <a href={`mailto:${contact}`} className="font-semibold underline">
                {contact}
              </a>
              .
            </>
          ) : (
            <> Contact: [privacy email to be added].</>
          )}
        </p>
        <p>
          If you&apos;re not happy with our answer, you may complain to the Information Regulator (South Africa):{" "}
          <a href="https://inforegulator.org.za" target="_blank" rel="noopener" className="underline">
            inforegulator.org.za
          </a>
          .
        </p>
      </Section>

      <Section title="Changes">
        <p>If we change how we handle personal information, we&apos;ll update this page and the date above.</p>
      </Section>

      <footer className="mt-10 border-t border-black/10 pt-4 text-center text-xs text-muted">
        <PlatformCredit />
      </footer>
    </main>
  );
}
