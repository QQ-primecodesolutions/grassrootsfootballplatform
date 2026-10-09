import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components: public data is cached with `use cache` + tags and invalidated
  // on demand by admin actions (see lib/cache). Pages stream behind Suspense.
  cacheComponents: true,
  // Prefetch one reusable App Shell per route; unknown params upgrade after first visit.
  partialPrefetching: true,
  poweredByHeader: false,
  experimental: {
    // Logo uploads go through a Server Action. The browser shrinks images first; the server
    // accepts up to 1.5 MB (lib/media/image.ts), plus room for the form encoding.
    serverActions: { bodySizeLimit: "2mb" },
  },
  // Graphics read fonts and logos from disk at request time (lib/graphics/assets.ts); make
  // sure serverless bundles include them.
  outputFileTracingIncludes: {
    "/graphics/**/*": ["./assets/fonts/*.ttf", "./public/brand/**/*"],
  },
};

export default nextConfig;
