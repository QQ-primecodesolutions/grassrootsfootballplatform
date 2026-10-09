"use client";

import { useActionState, useState } from "react";
import { inviteAdminAction, memberLinkAction, type LinkState } from "@/app/admin/(panel)/platform/actions";
import { Field, FormMessage, inputClass } from "./fields";

const initial: LinkState = { ok: false, message: null };

/** Add an organisation admin: creates their account and a one-time link to send on WhatsApp. */
export function InviteForm({ orgId, orgName }: { orgId: string; orgName: string }) {
  const [state, action, pending] = useActionState<LinkState, FormData>(inviteAdminAction, initial);
  return (
    <div className="space-y-3">
      <form action={action} className="space-y-3">
        <input type="hidden" name="orgId" value={orgId} />
        <input type="hidden" name="orgName" value={orgName} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Their name">
            <input name="name" required maxLength={80} autoComplete="off" className={inputClass} />
          </Field>
          <Field label="Their email" hint="They sign in with this">
            <input name="email" type="email" required maxLength={200} autoComplete="off" inputMode="email" className={inputClass} />
          </Field>
        </div>
        <Field label="Role" hint="A scorer only enters scores; an organisation admin publishes them.">
          <select name="role" defaultValue="org_admin" className={inputClass}>
            <option value="org_admin">Organisation admin (everything)</option>
            <option value="scorer">Scorer (enters scores only)</option>
          </select>
        </Field>
        <button type="submit" disabled={pending} className="h-12 w-full rounded-lg bg-gray-900 font-semibold text-white disabled:opacity-60">
          {pending ? "Creating…" : "Add person"}
        </button>
      </form>
      <FormMessage ok={state.ok} message={state.message} />
      {state.link ? <LinkResult link={state.link} /> : null}
    </div>
  );
}

/** "New invite link" / "Password reset link" for one admin. */
export function MemberLinkButton({
  orgId,
  orgName,
  userId,
  name,
  active,
}: {
  orgId: string;
  orgName: string;
  userId: string;
  name: string;
  active: boolean;
}) {
  const [state, action, pending] = useActionState<LinkState, FormData>(memberLinkAction, initial);
  return (
    <div className="space-y-2">
      <form action={action}>
        <input type="hidden" name="orgId" value={orgId} />
        <input type="hidden" name="orgName" value={orgName} />
        <input type="hidden" name="userId" value={userId} />
        <input type="hidden" name="name" value={name} />
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-white px-3 py-2 text-sm font-semibold ring-1 ring-black/15 disabled:opacity-60"
        >
          {pending ? "Creating…" : active ? "Password reset link" : "New invite link"}
        </button>
      </form>
      {state.message && !state.link ? <FormMessage ok={state.ok} message={state.message} /> : null}
      {state.link ? <LinkResult link={state.link} /> : null}
    </div>
  );
}

/** A one-time link with WhatsApp and copy buttons, shown once after it is created. */
export function LinkResult({ link }: { link: NonNullable<LinkState["link"]> }) {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link.whatsappText);
      setCopied("Message copied.");
    } catch {
      setCopied("Couldn't copy. Long-press the link to select it.");
    }
  };
  return (
    <div className="space-y-2 rounded-lg bg-amber-50 p-3 text-sm ring-1 ring-amber-200">
      <p className="font-semibold text-amber-900">
        Send this {link.purpose === "invite" ? "invite" : "reset"} link to them only. Anyone with it can set the password.
      </p>
      <p className="break-all rounded bg-white p-2 font-mono text-xs ring-1 ring-black/10">{link.url}</p>
      <div className="grid grid-cols-2 gap-2">
        <a
          href={`https://wa.me/?text=${encodeURIComponent(link.whatsappText)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-11 items-center justify-center rounded-lg bg-[#1f7a3f] font-semibold text-white"
        >
          WhatsApp
        </a>
        <button type="button" onClick={copy} className="h-11 rounded-lg bg-white font-semibold ring-1 ring-black/15">
          Copy message
        </button>
      </div>
      {copied ? <p role="status">{copied}</p> : null}
    </div>
  );
}
