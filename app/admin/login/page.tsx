import type { Metadata } from "next";
import Image from "next/image";
import { Suspense } from "react";
import { publicEnv } from "@/lib/env";
import platformLogo from "@/public/brand/platform-logo.png";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Admin login", robots: { index: false, follow: false } };

export default function LoginPage() {
  return (
    <main className="mx-auto w-full max-w-sm flex-1 px-4 py-12">
      <Image src={platformLogo} alt={publicEnv.NEXT_PUBLIC_APP_NAME} priority className="h-auto w-56" />
      <h1 className="mt-6 font-display text-3xl font-bold uppercase tracking-wide">Admin</h1>
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
