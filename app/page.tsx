import Link from "next/link";
import { redirect } from "next/navigation";
import { listOrganisations } from "@/lib/db/queries";
import { publicEnv } from "@/lib/env";

export default async function HomePage() {
  const orgs = await listOrganisations();
  if (orgs.length === 1) redirect(`/${orgs[0]!.slug}`);

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-8">
      <h1 className="font-display text-3xl font-bold uppercase tracking-wide">{publicEnv.NEXT_PUBLIC_APP_NAME}</h1>
      <p className="mt-1 text-muted">Choose a league organiser.</p>
      {orgs.length === 0 ? (
        <p className="mt-6 text-muted">No organisations yet.</p>
      ) : (
        <ul className="mt-6 space-y-2">
          {orgs.map((o) => (
            <li key={o.id}>
              <Link
                href={`/${o.slug}`}
                className="flex items-center gap-3 rounded-lg bg-surface p-4 shadow-sm ring-1 ring-black/5 hover:ring-black/20"
              >
                <span
                  aria-hidden
                  className="h-10 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: o.primaryColor }}
                />
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{o.name}</span>
                  {o.tagline ? <span className="block truncate text-sm text-muted">{o.tagline}</span> : null}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
