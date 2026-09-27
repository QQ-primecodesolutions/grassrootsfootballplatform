import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components: public data is cached with `use cache` + tags and invalidated
  // on demand by admin actions (see lib/cache). Pages stream behind Suspense.
  cacheComponents: true,
  // Prefetch one reusable App Shell per route; unknown params upgrade after first visit.
  partialPrefetching: true,
  poweredByHeader: false,
};

export default nextConfig;
