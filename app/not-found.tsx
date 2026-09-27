import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-16 text-center">
      <p className="font-display text-5xl font-bold">404</p>
      <h1 className="mt-2 text-lg font-semibold">We couldn&apos;t find that page</h1>
      <p className="mt-1 text-sm text-muted">The link may be old, or the match or team may have moved.</p>
      <Link href="/" className="mt-6 inline-block rounded-lg bg-brand px-4 py-3 font-semibold text-on-brand">
        Go to the home page
      </Link>
    </main>
  );
}
