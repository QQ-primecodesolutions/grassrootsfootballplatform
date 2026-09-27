/** Placeholder shown instantly on navigation while a page's data streams in. */
export function PageSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading" className="space-y-3">
      <div className="h-7 w-2/3 animate-pulse rounded bg-black/10" />
      <div className="h-4 w-1/3 animate-pulse rounded bg-black/10" />
      <div className="h-10 animate-pulse rounded-lg bg-black/10" />
      <div className="h-72 animate-pulse rounded-lg bg-black/5" />
    </div>
  );
}
