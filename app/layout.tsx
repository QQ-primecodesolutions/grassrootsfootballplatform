import type { Metadata, Viewport } from "next";
import { publicEnv, siteUrl } from "@/lib/env";
import "./globals.css";

const appName = publicEnv.NEXT_PUBLIC_APP_NAME;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: appName, template: `%s · ${appName}` },
  description: "League tables, fixtures and results for community football.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-ZA" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
