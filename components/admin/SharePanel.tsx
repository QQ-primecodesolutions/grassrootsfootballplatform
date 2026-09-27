"use client";

import { useState, useSyncExternalStore } from "react";
import type { MatchShare } from "@/lib/share/for-match";

const noSubscribe = () => () => {};
/** True only in browsers with the Web Share API (false during server render: no hydration mismatch). */
function useCanNativeShare() {
  return useSyncExternalStore(noSubscribe, () => "share" in navigator, () => false);
}
/** True where the Web Share API can share image files (e.g. Android Chrome → WhatsApp). */
function useCanShareFiles() {
  return useSyncExternalStore(
    noSubscribe,
    () => {
      try {
        return navigator.canShare?.({ files: [new File([""], "graphic.png", { type: "image/png" })] }) ?? false;
      } catch {
        return false;
      }
    },
    () => false,
  );
}

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export type GraphicLink = { label: string; href: string; downloadHref: string };

/** Shown after a result is confirmed: graphics, link, WhatsApp, Facebook caption. */
export function SharePanel({ share, graphics = [] }: { share: MatchShare; graphics?: GraphicLink[] }) {
  const [message, setMessage] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const canNativeShare = useCanNativeShare();
  const canShareFiles = useCanShareFiles();
  const mainGraphic = graphics[0];

  const doCopy = async (label: string, text: string) => {
    setMessage((await copy(text)) ? label : `Couldn't copy. Long-press to select instead.`);
  };

  // The PNG is fetched on tap (not on page load) to save mobile data.
  const shareImage = async () => {
    if (!mainGraphic) return;
    setSharing(true);
    setMessage(null);
    try {
      const res = await fetch(mainGraphic.href);
      if (!res.ok) throw new Error(String(res.status));
      const file = new File([await res.blob()], "result.png", { type: "image/png" });
      await navigator.share({ files: [file], text: share.whatsappText });
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) setMessage("Couldn't share the image. Download it instead.");
    } finally {
      setSharing(false);
    }
  };

  return (
    <section aria-label="Share this result" className="rounded-lg bg-green-50 p-4 ring-1 ring-green-200">
      <h2 className="font-display text-lg font-bold uppercase text-green-900">Published: share it</h2>
      <div className="mt-3 grid grid-cols-1 gap-2">
        {canShareFiles && mainGraphic ? (
          <button
            type="button"
            onClick={shareImage}
            disabled={sharing}
            className="h-12 rounded-lg bg-[#1f7a3f] font-semibold text-white disabled:opacity-60"
          >
            {sharing ? "Preparing image…" : "Share image…"}
          </button>
        ) : null}
        <a
          href={share.whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`flex h-12 items-center justify-center rounded-lg font-semibold ${
            canShareFiles && mainGraphic ? "bg-white ring-1 ring-black/15" : "bg-[#1f7a3f] text-white"
          }`}
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
        {canNativeShare && !canShareFiles ? (
          <button
            type="button"
            onClick={() => navigator.share({ text: share.whatsappText }).catch(() => undefined)}
            className="h-12 rounded-lg bg-white font-semibold ring-1 ring-black/15"
          >
            Share…
          </button>
        ) : null}
      </div>

      {graphics.length ? (
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-green-900">Download graphics</h3>
          <ul className="mt-2 grid grid-cols-2 gap-2">
            {graphics.map((g) => (
              <li key={g.href}>
                <a
                  href={g.downloadHref}
                  download
                  className="flex min-h-12 items-center justify-center rounded-lg bg-white px-2 text-center text-sm font-semibold ring-1 ring-black/15"
                >
                  {g.label}
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-1 text-xs text-green-900/80">PNG, ready for Facebook, Instagram and WhatsApp status.</p>
        </div>
      ) : null}

      <a href={share.matchUrl} target="_blank" rel="noopener noreferrer" className="mt-2 block py-2 text-center text-sm font-semibold underline">
        Open the public match page
      </a>
      {message ? (
        <p role="status" className="mt-2 text-center text-sm font-semibold text-green-900">
          {message}
        </p>
      ) : null}
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer text-green-900">Show the Facebook caption</summary>
        <textarea readOnly value={share.facebookCaption} rows={9} className="mt-2 block w-full rounded border border-black/15 bg-white p-2 text-sm" />
      </details>
    </section>
  );
}
