import type { Metadata } from "next";
import { Suspense } from "react";
import { PasswordFields } from "@/components/admin/PasswordForm";
import { PageSkeleton } from "@/components/public/PageSkeleton";
import { getCurrentUser } from "@/lib/auth";
import { listAccessibleOrgs } from "@/lib/db/queries/accounts";
import { changeOwnPassword } from "../../actions";

export const metadata: Metadata = { title: "Account" };

export default function AccountPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Account />
    </Suspense>
  );
}

async function Account() {
  const { user } = await getCurrentUser();
  const orgs = await listAccessibleOrgs(user);

  return (
    <>
      <h1 className="font-display text-2xl font-bold uppercase tracking-wide">Your account</h1>
      <dl className="mt-3 space-y-1 rounded-lg bg-white p-3 text-sm shadow-sm ring-1 ring-black/5">
        <div>
          <dt className="inline font-semibold">Name: </dt>
          <dd className="inline">{user.name}</dd>
        </div>
        <div>
          <dt className="inline font-semibold">Email: </dt>
          <dd className="inline">{user.email}</dd>
        </div>
        <div>
          <dt className="inline font-semibold">Access: </dt>
          <dd className="inline">
            {user.isSuperAdmin ? "Platform admin (all organisations)" : orgs.map((o) => o.name).join(", ") || "None"}
          </dd>
        </div>
      </dl>

      <h2 className="mt-6 font-display text-lg font-bold uppercase">Change password</h2>
      <PasswordFields action={changeOwnPassword} email={user.email} askCurrent submitLabel="Change password" />
    </>
  );
}
