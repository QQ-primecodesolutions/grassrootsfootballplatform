"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";

const ITEMS = [
  { href: "/admin", label: "Home", match: (p: string) => p === "/admin" },
  { href: "/admin/results", label: "Results", match: (p: string) => p.startsWith("/admin/results") },
  { href: "/admin/fixtures/paste", label: "Paste", match: (p: string) => p.startsWith("/admin/fixtures/paste") },
  { href: "/admin/fixtures/new", label: "Fixture", match: (p: string) => p.startsWith("/admin/fixtures/new") },
  { href: "/admin/teams", label: "Teams", match: (p: string) => p.startsWith("/admin/teams") },
];

/**
 * Bottom tab bar: big thumb-sized targets for use at the pitch.
 * usePathname() is URL data, so the highlighted version sits behind Suspense;
 * the fallback is the same bar without a highlight.
 */
export function AdminNav() {
  return (
    <Suspense fallback={<NavBar pathname={null} />}>
      <ActiveNav />
    </Suspense>
  );
}

function ActiveNav() {
  return <NavBar pathname={usePathname()} />;
}

function NavBar({ pathname }: { pathname: string | null }) {
  return (
    <nav
      aria-label="Admin"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-black/10 bg-white pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto grid max-w-2xl grid-cols-5">
        {ITEMS.map((item) => {
          const active = pathname !== null && item.match(pathname);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex h-14 items-center justify-center text-sm font-semibold ${
                  active ? "bg-gray-900 text-white" : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
