"use client";

import { useState } from "react";
import type { GraphicLink } from "@/lib/graphics/urls";
import { copyText, shareImage, useCanShareFiles } from "./share-hooks";

/**
 * Share a graphic before or outside a result: fixtures for a match day, or one match card.
 * The first graphic is the one shared and previewed. Images load only when tapped (mobile data).
 */
export function GraphicShare({
  title,
  graphics,
  text,
  fileName,
}: {
  title: string;
  graphics: GraphicLink[];
  /** WhatsApp message sent with the image (or on its own). */
  text: string;
  fileName: string;
}) {
  const canShareFiles = useCanShareFiles();
  const [message, setMessage] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [preview, setPreview] = useState(false);
  const main = graphics[0];

  const onShareImage = async () => {
    if (!main) return;
    setSharing(true);
    setMessage(null);
    const result = await shareImage(main.href, fileName, text);
    if (result === "failed") setMessage("Couldn't share the image. Download it instead.");
    setSharing(false);
  };

  return (
    <section aria-label={title} className="rounded-lg bg-sky-50 p-4 ring-1 ring-sky-200">
      <h2 className="font-display text-lg font-bold uppercase text-sky-950">{title}</h2>
      <div className="mt-3 grid grid-cols-1 gap-2">
        {canShareFiles && main ? (
          <button
            type="button"
            onClick={onShareImage}
            disabled={sharing}
            className="h-12 rounded-lg bg-[#1f7a3f] font-semibold text-white disabled:opacity-60"
          >
            {sharing ? "Preparing image…" : "Share image…"}
          </button>
        ) : null}
        <div className="grid grid-cols-2 gap-2">
          <a
            href={`https://wa.me/?text=${encodeURIComponent(text)}`}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex h-12 items-center justify-center rounded-lg font-semibold ${
              canShareFiles && main ? "bg-white ring-1 ring-black/15" : "bg-[#1f7a3f] text-white"
            }`}
          >
            WhatsApp text
          </a>
          <button
            type="button"
            onClick={async () => setMessage((await copyText(text)) ? "Message copied" : "Couldn't copy. Use WhatsApp text instead.")}
            className="h-12 rounded-lg bg-white font-semibold ring-1 ring-black/15"
          >
            Copy message
          </button>
        </div>
      </div>

      {graphics.length ? (
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-sky-950">Download graphics</h3>
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
          {main ? (
            preview ? (
              // eslint-disable-next-line @next/next/no-img-element -- a dynamic PNG route; next/image adds nothing here
              <img src={main.href} alt={`Preview: ${main.label}`} className="mt-3 w-full rounded-lg ring-1 ring-black/10" />
            ) : (
              <button type="button" onClick={() => setPreview(true)} className="mt-2 py-2 text-sm font-semibold text-sky-950 underline">
                Show preview
              </button>
            )
          ) : null}
        </div>
      ) : null}

      {message ? (
        <p role="status" className="mt-2 text-center text-sm font-semibold text-sky-950">
          {message}
        </p>
      ) : null}
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer text-sky-950">Show the message</summary>
        <textarea readOnly value={text} rows={8} className="mt-2 block w-full rounded border border-black/15 bg-white p-2 text-sm" />
      </details>
    </section>
  );
}
