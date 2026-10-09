import { describe, expect, it } from "vitest";
import { clearEdgeBackground, contentBox, hasTransparency, type Pixels } from "@/lib/media/trim";

/** A w×h image filled with `bg`, with `paint` drawn on top: paint(x, y) → colour or null. */
function image(w: number, h: number, bg: number[], paint: (x: number, y: number) => number[] | null): Pixels {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) data.set(paint(x, y) ?? bg, (y * w + x) * 4);
  return { data, width: w, height: h };
}
const alphaAt = (img: Pixels, x: number, y: number) => img.data[(y * img.width + x) * 4 + 3];

const WHITE = [255, 255, 255, 255];
const NEAR_WHITE = [250, 248, 252, 255];
const GREEN = [20, 120, 60, 255];

describe("logo tidying", () => {
  // A green ring (outline) on white, with white inside the ring, from x/y 10..29.
  const ring = (x: number, y: number) => {
    const inBox = x >= 10 && x <= 29 && y >= 10 && y <= 29;
    const onEdge = x === 10 || x === 29 || y === 10 || y === 29;
    return inBox && onEdge ? GREEN : null;
  };

  it("makes the outer background transparent but keeps enclosed white", () => {
    const img = image(40, 40, WHITE, ring);
    expect(clearEdgeBackground(img)).toBe(true);
    expect(alphaAt(img, 0, 0)).toBe(0);
    expect(alphaAt(img, 5, 20)).toBe(0);
    expect(alphaAt(img, 10, 10)).toBe(255); // the ring
    expect(alphaAt(img, 20, 20)).toBe(255); // white inside the ring stays
    expect(hasTransparency(img)).toBe(true);
  });

  it("treats slightly off-white JPEG backgrounds as background", () => {
    const img = image(40, 40, NEAR_WHITE, (x, y) => (x === 3 && y === 3 ? WHITE : ring(x, y)));
    expect(clearEdgeBackground(img)).toBe(true);
    expect(alphaAt(img, 3, 3)).toBe(0);
  });

  it("leaves images alone when the corners don't agree or are already transparent", () => {
    const photo = image(40, 40, WHITE, (x) => (x < 20 ? GREEN : null));
    expect(clearEdgeBackground(photo)).toBe(false);
    expect(hasTransparency(photo)).toBe(false);
    const png = image(40, 40, [0, 0, 0, 0], ring);
    expect(clearEdgeBackground(png)).toBe(false);
  });

  it("finds the box around the logo, with a little padding", () => {
    const img = image(40, 40, WHITE, ring);
    clearEdgeBackground(img);
    expect(contentBox(img, 0)).toEqual({ x: 10, y: 10, width: 20, height: 20 });
    expect(contentBox(img, 0.1)).toEqual({ x: 8, y: 8, width: 24, height: 24 });
    expect(contentBox(image(5, 5, [0, 0, 0, 0], () => null))).toBeNull();
  });
});
