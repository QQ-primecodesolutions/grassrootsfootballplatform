import type { Metadata, Viewport } from "next";
import { Barlow_Condensed } from "next/font/google";
import { publicEnv, siteUrl } from "@/lib/env";
import "./globals.css";

const appName = publicEnv.NEXT_PUBLIC_APP_NAME;

// Headings and scores only; body text uses the system font (no download).
// next/font self-hosts the file at build time, so phones never call Google.
const display = Barlow_Condensed({
  weight: ["600", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-barlow-condensed",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: appName, template: `%s · ${appName}` },
  description: "League tables, fixtures and results for community football.",
  applicationName: appName,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-ZA" className={`h-full antialiased ${display.variable}`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
