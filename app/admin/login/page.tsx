import type { Metadata } from "next";
import { Suspense } from "react";
import { publicEnv } from "@/lib/env";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Admin login", robots: { index: false, follow: false } };

export default function LoginPage() {
  return (
    <main className="mx-auto w-full max-w-sm flex-1 px-4 py-12">
      <p className="text-sm font-semibold uppercase tracking-wide text-muted">{publicEnv.NEXT_PUBLIC_APP_NAME}</p>
      <h1 className="font-display text-3xl font-bold uppercase tracking-wide">Admin</h1>
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
