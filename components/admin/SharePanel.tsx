"use client";

import { useState, useSyncExternalStore } from "react";

const noSubscribe = () => () => {};
/** True only in browsers with the Web Share API (false during server render: no hydration mismatch). */
function useCanNativeShare() {
  return useSyncExternalStore(noSubscribe, () => "share" in navigator, () => false);
}
import type { MatchShare } from "@/lib/share/for-match";

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Shown after a result is confirmed: link, WhatsApp, Facebook caption. */
export function SharePanel({ share }: { share: MatchShare }) {
  const [copied, setCopied] = useState<string | null>(null);
  const canNativeShare = useCanNativeShare();

  const doCopy = async (label: string, text: string) => {
    setCopied((await copy(text)) ? label : `Couldn't copy. Long-press to select instead.`);
  };

  return (
    <section aria-label="Share this result" className="rounded-lg bg-green-50 p-4 ring-1 ring-green-200">
      <h2 className="font-display text-lg font-bold uppercase text-green-900">Published: share it</h2>
      <div className="mt-3 grid grid-cols-1 gap-2">
        <a
          href={share.whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-12 items-center justify-center rounded-lg bg-[#1f7a3f] font-semibold text-white"
        >
          Share to WhatsApp
        </a>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => doCopy("Link copied", share.matchUrl)}
            className="h-12 rounded-lg bg-white font-semibold ring-1 ring-black/15"
          >
            Copy link
          </button>
          <button
            type="button"
            onClick={() => doCopy("Facebook caption copied", share.facebookCaption)}
            className="h-12 rounded-lg bg-white font-semibold ring-1 ring-black/15"
          >
            Copy FB caption
          </button>
        </div>
        {canNativeShare ? (
          <button
            type="button"
            onClick={() => navigator.share({ text: share.whatsappText }).catch(() => undefined)}
            className="h-12 rounded-lg bg-white font-semibold ring-1 ring-black/15"
          >
            Share…
          </button>
        ) : null}
        <a href={share.matchUrl} target="_blank" rel="noopener noreferrer" className="py-2 text-center text-sm font-semibold underline">
          Open the public match page
        </a>
      </div>
      {copied ? (
        <p role="status" className="mt-2 text-center text-sm font-semibold text-green-900">
          {copied}
        </p>
      ) : null}
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer text-green-900">Show the Facebook caption</summary>
        <textarea readOnly value={share.facebookCaption} rows={9} className="mt-2 block w-full rounded border border-black/15 bg-white p-2 text-sm" />
      </details>
    </section>
  );
}
