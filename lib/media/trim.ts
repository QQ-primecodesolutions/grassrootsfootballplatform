/**
 * Tidy an uploaded logo's pixels (pure; the browser supplies canvas ImageData):
 * 1. If the four corners share one solid colour (typically the white of a JPEG), make that
 *    colour transparent wherever it is connected to the edge. Enclosed areas of the same
 *    colour inside the logo (e.g. white lettering) are kept.
 * 2. Find the box around what's left, so empty margins can be cropped away.
 */

export type Pixels = { data: Uint8ClampedArray; width: number; height: number };

const OPAQUE = 250;

function near(d: Uint8ClampedArray, i: number, rgb: [number, number, number], tolerance: number): boolean {
  return Math.abs(d[i]! - rgb[0]) + Math.abs(d[i + 1]! - rgb[1]) + Math.abs(d[i + 2]! - rgb[2]) <= tolerance;
}

/** Returns true if a background was found and made transparent (the pixels are changed in place). */
export function clearEdgeBackground(img: Pixels, tolerance = 60): boolean {
  const { data: d, width: w, height: h } = img;
  if (w < 3 || h < 3) return false;
  const corners = [0, w - 1, (h - 1) * w, h * w - 1].map((p) => p * 4);
  if (corners.some((i) => d[i + 3]! < OPAQUE)) return false; // already transparent: nothing to clear
  const bg: [number, number, number] = [d[corners[0]!]!, d[corners[0]! + 1]!, d[corners[0]! + 2]!];
  if (!corners.every((i) => near(d, i, bg, tolerance))) return false; // no single background colour

  const seen = new Uint8Array(w * h);
  const queue = new Int32Array(w * h);
  let head = 0;
  let tail = 0;
  const push = (p: number) => {
    if (!seen[p] && near(d, p * 4, bg, tolerance)) {
      seen[p] = 1;
      queue[tail++] = p;
    }
  };
  for (let x = 0; x < w; x++) {
    push(x);
    push((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    push(y * w);
    push(y * w + w - 1);
  }
  while (head < tail) {
    const p = queue[head++]!;
    d[p * 4 + 3] = 0;
    const x = p % w;
    if (x > 0) push(p - 1);
    if (x < w - 1) push(p + 1);
    if (p >= w) push(p - w);
    if (p < (h - 1) * w) push(p + w);
  }
  return true;
}

/** The box around visible pixels, with a little padding; null if the image is empty. */
export function contentBox(img: Pixels, padRatio = 0.03): { x: number; y: number; width: number; height: number } | null {
  const { data: d, width: w, height: h } = img;
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (d[(y * w + x) * 4 + 3]! > 16) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  const pad = Math.round(Math.max(maxX - minX, maxY - minY) * padRatio);
  const x = Math.max(0, minX - pad);
  const y = Math.max(0, minY - pad);
  return { x, y, width: Math.min(w, maxX + pad + 1) - x, height: Math.min(h, maxY + pad + 1) - y };
}

export function hasTransparency(img: Pixels): boolean {
  for (let i = 3; i < img.data.length; i += 4) if (img.data[i]! < OPAQUE) return true;
  return false;
}
