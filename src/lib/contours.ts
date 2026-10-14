/* ------------------------------------------------------------------
   SILHOUETTES — parametric outlines for the tracking overlay.

   The tracker needs a contour that hugs each cut-out. Instead of
   extracting one from the bitmap at build time, every shape knows how
   to describe itself: closed polygons in element-local UV space
   (0..1), plus a bounding box per blob used for the corner brackets.
   ------------------------------------------------------------------ */

export type Blob = { p: [number, number][]; b: [number, number, number, number] };

type Gen = () => Blob[];

const TAU = Math.PI * 2;

function circleBlob(cx: number, cy: number, r: number, n = 48, wob = 0.004, seed = 1): Blob {
  let s = seed * 9301 + 49297;
  const rnd = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  const p: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = TAU * (i / n);
    const rr = r * (1 + (rnd() - 0.5) * 2 * wob);
    p.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  return { p, b: [cx - r, cy - r, r * 2, r * 2] };
}

function starBlob(points: number, inner: number, seed: number): Blob {
  let s = seed * 9301 + 49297;
  const rnd = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  const p: [number, number][] = [];
  const R = 0.48;
  for (let i = 0; i < points * 2; i++) {
    const a = Math.PI * (i / points) - Math.PI / 2;
    const r = (i % 2 === 0 ? R : R * inner) * (1 + (rnd() - 0.5) * 0.05);
    p.push([0.5 + Math.cos(a) * r, 0.5 + Math.sin(a) * r]);
  }
  return { p, b: [0.5 - R, 0.5 - R, R * 2, R * 2] };
}

function roundedRectBlob(x: number, y: number, w: number, h: number, n = 40, seed = 2): Blob {
  let s = seed * 9301 + 49297;
  const rnd = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  const p: [number, number][] = [];
  const pts: [number, number][] = [
    [x + w * 0.15, y], [x + w * 0.85, y],
    [x + w, y + h * 0.15], [x + w, y + h * 0.85],
    [x + w * 0.85, y + h], [x + w * 0.15, y + h],
    [x, y + h * 0.85], [x, y + h * 0.15],
  ];
  // walk the perimeter, jittering a little so it reads as a solve, not a sticker
  for (let i = 0; i < n; i++) {
    const t = (i / n) * 8;
    const i0 = Math.floor(t) % 8;
    const i1 = (i0 + 1) % 8;
    const f = t - Math.floor(t);
    const u = pts[i0][0] + (pts[i1][0] - pts[i0][0]) * f + (rnd() - 0.5) * 0.01;
    const v = pts[i0][1] + (pts[i1][1] - pts[i0][1]) * f + (rnd() - 0.5) * 0.01;
    p.push([u, v]);
  }
  return { p, b: [x, y, w, h] };
}

function scallopBlob(cx: number, cy: number, r: number, lobes: number, n = 72, seed = 3): Blob {
  let s = seed * 9301 + 49297;
  const rnd = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  const p: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = TAU * (i / n);
    const rr = r * (0.68 + 0.32 * Math.pow(0.5 + 0.5 * Math.cos(a * lobes), 1.4)) * (1 + (rnd() - 0.5) * 0.02);
    p.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  return { p, b: [cx - r, cy - r, r * 2, r * 2] };
}

const GEN: Record<string, Gen> = {
  "star-a": () => [starBlob(9, 0.42, 7)],
  "star-b": () => [starBlob(12, 0.40, 11)],
  dice: () => [roundedRectBlob(0.16, 0.20, 0.68, 0.66, 44, 5)],
  "cd-a": () => [circleBlob(0.5, 0.5, 0.48, 52, 0.003, 3)],
  "cd-b": () => [circleBlob(0.5, 0.5, 0.48, 52, 0.003, 9)],
  flower: () => [scallopBlob(0.5, 0.5, 0.47, 8, 80, 4)],
  cards: () => [
    roundedRectBlob(0.10, 0.34, 0.44, 0.52, 36, 6),
    roundedRectBlob(0.30, 0.24, 0.44, 0.52, 36, 7),
    roundedRectBlob(0.50, 0.14, 0.44, 0.52, 36, 8),
  ],
};

export function contoursFor(shape: string): Blob[] {
  const g = GEN[shape];
  return g ? g() : [];
}
