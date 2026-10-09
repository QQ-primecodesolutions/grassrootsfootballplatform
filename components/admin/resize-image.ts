"use client";

import { clearEdgeBackground, contentBox, hasTransparency } from "@/lib/media/trim";

/**
 * Prepare a picked logo in the browser before upload:
 * - remove a plain background colour touching the edges (e.g. a JPEG's white) and crop the
 *   empty margins, so the logo fills its space on graphics instead of sitting small in a box;
 * - shrink it (a phone photo can be several MB; graphics never draw a logo bigger than a few
 *   hundred pixels), which saves mobile data and keeps uploads under the server limit.
 * Logos with transparency are PNG; solid ones stay JPEG if they were JPEG (smaller).
 */
const TARGET_BYTES = 400_000;
/** Graphics draw logos at most ~300 px tall at 1080 px wide, so 600 px is sharp everywhere. */
const MAX_SIDE = 600;
/** Pixels scanned for background and margins (keeps the scan fast on phones). */
const WORK_SIDE = 1200;

function toBlob(canvas: HTMLCanvasElement, type: "image/png" | "image/jpeg", quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode"))), type, quality),
  );
}

function canvasOf(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return [canvas, canvas.getContext("2d", { willReadFrequently: true })!];
}

/** Scale `source` (a region of it) to fit `maxSide`, optionally on a solid background. */
function scaled(source: CanvasImageSource, box: { x: number; y: number; width: number; height: number }, maxSide: number, background?: string) {
  const scale = Math.min(1, maxSide / Math.max(box.width, box.height));
  const [canvas, ctx] = canvasOf(box.width * scale, box.height * scale);
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(source, box.x, box.y, box.width, box.height, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export async function prepareLogo(file: File): Promise<Blob> {
  // Throws for formats the browser can't decode (e.g. HEIC outside Safari).
  const bitmap = await createImageBitmap(file);
  try {
    const full = { x: 0, y: 0, width: bitmap.width, height: bitmap.height };
    const work = scaled(bitmap, full, WORK_SIDE);
    const ctx = work.getContext("2d", { willReadFrequently: true })!;
    const pixels = ctx.getImageData(0, 0, work.width, work.height);
    if (clearEdgeBackground(pixels)) ctx.putImageData(pixels, 0, 0);
    const box = contentBox(pixels) ?? { x: 0, y: 0, width: work.width, height: work.height };
    const transparent = hasTransparency(pixels);

    if (!transparent && file.type === "image/jpeg") return await toBlob(scaled(work, box, MAX_SIDE, "#FFFFFF"), "image/jpeg", 0.88);
    for (const side of [MAX_SIDE, 480]) {
      const png = await toBlob(scaled(work, box, side), "image/png");
      if (png.size <= TARGET_BYTES) return png;
    }
    return await toBlob(scaled(work, box, MAX_SIDE, "#FFFFFF"), "image/jpeg", 0.85);
  } finally {
    bitmap.close();
  }
}
