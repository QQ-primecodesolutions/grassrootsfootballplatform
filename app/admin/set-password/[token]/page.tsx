import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { PasswordFields } from "@/components/admin/PasswordForm";
import { PageSkeleton } from "@/components/public/PageSkeleton";
import { peekLinkToken } from "@/lib/db/queries/accounts";
import { publicEnv } from "@/lib/env";
import { setPasswordFromLink } from "../../actions";

export const metadata: Metadata = {
  title: "Choose a password",
  robots: { index: false, follow: false },
  // The token is in the URL: never send it to other sites as a referrer.
  referrer: "no-referrer",
};

export default function SetPasswordPage({ params }: PageProps<"/admin/set-password/[token]">) {
  return (
    <main className="mx-auto w-full max-w-sm flex-1 px-4 py-12">
      <p className="text-sm font-semibold uppercase tracking-wide text-muted">{publicEnv.NEXT_PUBLIC_APP_NAME}</p>
      <Suspense fallback={<PageSkeleton />}>
        <SetPassword params={params} />
      </Suspense>
    </main>
  );
}

async function SetPassword({ params }: Pick<PageProps<"/admin/set-password/[token]">, "params">) {
  const { token } = await params;
  // Link expiry depends on the current time: always render at request time.
  await connection();
  const link = await peekLinkToken(token, new Date());

  if (!link) {
    return (
      <>
        <h1 className="font-display text-3xl font-bold uppercase tracking-wide">Link expired</h1>
        <p className="mt-4">
          This link has expired or was already used. Ask the platform admin to send you a new one.
        </p>
        <Link href="/admin/login" className="mt-6 inline-block font-semibold underline">
          Go to sign in
        </Link>
      </>
    );
  }

  return (
    <>
      <h1 className="font-display text-3xl font-bold uppercase tracking-wide">
        {link.purpose === "invite" ? "Welcome" : "New password"}
      </h1>
      <p className="mt-2">
        {link.purpose === "invite" ? `Hi ${link.name}, choose a password to finish setting up your admin account.` : `Hi ${link.name}, choose a new password.`}
      </p>
      <p className="mt-1 text-sm text-gray-600">
        You&apos;ll sign in with <strong>{link.email}</strong>. We keep only your name and email, to let you sign in.
      </p>
      <PasswordFields
        action={setPasswordFromLink}
        hidden={{ token }}
        email={link.email}
        submitLabel={link.purpose === "invite" ? "Set password and sign in" : "Save and sign in"}
      />
    </>
  );
}
