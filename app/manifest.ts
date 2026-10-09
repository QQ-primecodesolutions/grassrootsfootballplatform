import type { MetadataRoute } from "next";
import { publicEnv } from "@/lib/env";

/** "Add to home screen": opens the platform like an app, with its name and icon. */
export default function manifest(): MetadataRoute.Manifest {
  const name = publicEnv.NEXT_PUBLIC_APP_NAME;
  return {
    name,
    short_name: name,
    description: "League tables, fixtures and results for community football.",
    start_url: "/",
    display: "standalone",
    background_color: "#F4F4F2",
    theme_color: "#0E4A2A",
    icons: [{ src: "/brand/platform-icon.png", sizes: "192x192", type: "image/png" }],
  };
}
