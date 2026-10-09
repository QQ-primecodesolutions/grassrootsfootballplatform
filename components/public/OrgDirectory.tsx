"use client";

import Link from "next/link";
import { useId, useState } from "react";

export type DirectoryOrg = {
  id: string;
  slug: string;
  name: string;
  shortName: string | null;
  tagline: string | null;
  logoUrl: string | null;
  primaryColor: string;
};

/** Normalise for matching: lower case, no accents, single spaces. */
function norm(s: string): string {
  return s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** Every word typed must appear in the organisation's name, short name or tagline. */
export function matchesQuery(org: DirectoryOrg, query: string): boolean {
  const words = norm(query).split(" ").filter(Boolean);
  if (!words.length) return true;
  const hay = norm([org.name, org.shortName, org.tagline].filter(Boolean).join(" "));
  return words.every((w) => hay.includes(w));
}

/**
 * Search box + organisation cards. The full list is in the HTML (works without JavaScript);
 * typing filters it in the browser, with no extra requests.
 */
export function OrgDirectory({ orgs, searchPlaceholder }: { orgs: DirectoryOrg[]; searchPlaceholder: string }) {
  const [query, setQuery] = useState("");
  const inputId = useId();
  const shown = orgs.filter((o) => matchesQuery(o, query));

  return (
    <div>
      <div className="relative mx-auto -mt-7 max-w-xl px-4">
        <label htmlFor={inputId} className="sr-only">
          Search organisations
        </label>
        <input
          id={inputId}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={searchPlaceholder}
          autoComplete="off"
          enterKeyHint="search"
          className="h-14 w-full rounded-full border border-black/10 bg-white pl-12 pr-4 text-base shadow-lg outline-none focus:ring-4 focus:ring-emerald-600/30"
        />
        <svg aria-hidden viewBox="0 0 24 24" className="pointer-events-none absolute left-9 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500">
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Zm5.3-2.2L21 21"
          />
        </svg>
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        {query ? `${shown.length} organisation${shown.length === 1 ? "" : "s"} found` : ""}
      </p>

      {shown.length ? (
        <ul className="mx-auto mt-6 grid max-w-3xl grid-cols-1 gap-3 px-4 sm:grid-cols-2">
          {shown.map((o) => (
            <li key={o.id}>
              <Link
                href={`/${o.slug}`}
                className="flex h-full items-center gap-3 overflow-hidden rounded-xl bg-white p-3 shadow-sm ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-md"
                style={{ borderLeft: `6px solid ${o.primaryColor}` }}
              >
                <span className="flex h-14 w-20 shrink-0 items-center justify-center rounded-lg bg-gray-50 p-1">
                  {o.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- organisation logos are small, already optimised files
                    <img src={o.logoUrl} alt="" loading="lazy" className="max-h-12 max-w-full object-contain" />
                  ) : (
                    <span className="font-display text-lg font-bold" style={{ color: o.primaryColor }}>
                      {(o.shortName ?? o.name).slice(0, 3).toUpperCase()}
                    </span>
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold leading-tight">{o.name}</span>
                  {o.tagline ? <span className="mt-0.5 block truncate text-sm text-muted">{o.tagline}</span> : null}
                  <span className="mt-1 block text-sm font-semibold text-emerald-800">Tables, fixtures &amp; results ›</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mx-auto mt-8 max-w-xl px-4 text-center text-muted">
          {orgs.length ? `No organisation matches “${query}”.` : "No organisations yet."}
        </p>
      )}
    </div>
  );
}
