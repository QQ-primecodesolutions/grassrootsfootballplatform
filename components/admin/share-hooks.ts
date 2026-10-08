"use client";

import { useSyncExternalStore } from "react";

const noSubscribe = () => () => {};

/** True only in browsers with the Web Share API (false during server render: no hydration mismatch). */
export function useCanNativeShare() {
  return useSyncExternalStore(noSubscribe, () => "share" in navigator, () => false);
}

/** True where the Web Share API can share image files (e.g. Android Chrome → WhatsApp). */
export function useCanShareFiles() {
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

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Fetch a PNG (on tap, not on page load, to save mobile data) and open the share sheet. */
export async function shareImage(href: string, fileName: string, text?: string): Promise<"shared" | "cancelled" | "failed"> {
  try {
    const res = await fetch(href);
    if (!res.ok) throw new Error(String(res.status));
    const file = new File([await res.blob()], fileName, { type: "image/png" });
    await navigator.share({ files: [file], ...(text ? { text } : {}) });
    return "shared";
  } catch (e) {
    return e instanceof DOMException && e.name === "AbortError" ? "cancelled" : "failed";
  }
}
