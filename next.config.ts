import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components: public data is cached with `use cache` + tags and invalidated
  // on demand by admin actions (see lib/cache). Pages stream behind Suspense.
  cacheComponents: true,
  // Prefetch one reusable App Shell per route; unknown params upgrade after first visit.
  partialPrefetching: true,
  poweredByHeader: false,
  // Graphics read fonts and logos from disk at request time (lib/graphics/assets.ts); make
  // sure serverless bundles include them.
  outputFileTracingIncludes: {
    "/graphics/**/*": ["./assets/fonts/*.ttf", "./public/brand/**/*"],
  },
};

export default nextConfig;
