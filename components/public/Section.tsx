import Link from "next/link";

/** A titled block with an optional "see all" link. */
export function Section({
  title,
  href,
  linkLabel = "See all",
  children,
}: {
  title: string;
  href?: string;
  linkLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-6">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h2 className="font-display text-lg font-bold uppercase tracking-wide">{title}</h2>
        {href ? (
          <Link href={href} className="py-1 text-sm font-semibold text-brand hover:underline">
            {linkLabel} →
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}
