/* ------------------------------------------------------------------
   THE OVERLAY — thin grey motion-tracking furniture over each stage.

   Contour trackers locked to the cut-outs (silhouettes come from
   contours.ts) plus free-floating ambient nodes drifting on a ring.

   Two rules it never breaks:
     · nothing crosses the type — every .lay is punched out of the
       clip, and the canvas sits under the type as a second defence;
     · it stays quiet — one hairline, mid grey, no fills, no colour.

   Draws only while its stage is on screen. Reduced motion: paint one
   frozen solve, redraw only on layout change.
   ------------------------------------------------------------------ */

import { contoursFor, type Blob } from "./contours";

const TAU = Math.PI * 2;
const DPR = Math.min(2, typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1);

function rndFactory(seed: number) {
  let s = seed * 9301 + 49297;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

type Mark = {
  el: HTMLElement;
  blobs: Blob[];
  id: string;
  rnd: () => number;
};

type Node = {
  a: number; av: number; rx: number; ry: number;
  wob: number; wp: number; wv: number; s: number;
};

class Overlay {
  stage: HTMLElement;
  cv: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  on = false;
  w = 0;
  h = 0;
  marks: Mark[] = [];
  lays: HTMLElement[] = [];
  nodes: Node[] = [];

  constructor(stage: HTMLElement, idx: number) {
    this.stage = stage;
    this.cv = document.createElement("canvas");
    this.cv.className = "trk";
    this.cv.setAttribute("aria-hidden", "true");
    stage.insertBefore(this.cv, stage.firstChild);
    const ctx = this.cv.getContext("2d");
    if (!ctx) throw new Error("no 2d ctx");
    this.ctx = ctx;

    stage.querySelectorAll<HTMLElement>(".el").forEach((el, k) => {
      const shape = el.getAttribute("data-shape") || "";
      const blobs = contoursFor(shape);
      if (!blobs.length) return;
      this.marks.push({
        el,
        blobs,
        id: "TRK_" + String(this.marks.length + 1 + idx * 3).padStart(2, "0"),
        rnd: rndFactory(shape.length * 37 + idx * 11 + k),
      });
    });

    this.lays = Array.from(stage.querySelectorAll<HTMLElement>(".lay"));

    const r = rndFactory(idx * 977 + 13);
    for (let i = 0; i < 7; i++) {
      this.nodes.push({
        a: r() * TAU,
        av: (r() - 0.5) * 0.016,
        rx: 0.40 + r() * 0.13,
        ry: 0.36 + r() * 0.14,
        wob: 0.012 + r() * 0.018,
        wp: r() * TAU,
        wv: 0.10 + r() * 0.18,
        s: 0.6 + r() * 0.5,
      });
    }
  }

  resize(): boolean {
    const w = this.stage.offsetWidth;
    const h = this.stage.offsetHeight;
    if (!w || !h) return false;
    if (w === this.w && h === this.h) return true;
    this.w = w;
    this.h = h;
    this.cv.width = Math.round(w * DPR);
    this.cv.height = Math.round(h * DPR);
    return true;
  }

  /* element box + its transform applied about its own centre, so a tracker
     stays welded to a cut-out that is drifting AND slowly rotating */
  boxOf(el: HTMLElement) {
    const x = el.offsetLeft, y = el.offsetTop, w = el.offsetWidth, h = el.offsetHeight;
    const t = getComputedStyle(el).transform;
    let M: DOMMatrix | null = null;
    if (t && t !== "none") {
      try { M = new DOMMatrix(t); } catch { M = null; }
    }
    return { x, y, w, h, cx: x + w / 2, cy: y + h / 2, M };
  }

  mapPt(b: ReturnType<Overlay["boxOf"]>, u: number, v: number): [number, number] {
    const px = b.x + u * b.w, py = b.y + v * b.h;
    if (!b.M) return [px, py];
    const dx = px - b.cx, dy = py - b.cy;
    return [b.cx + b.M.a * dx + b.M.c * dy, b.cy + b.M.b * dx + b.M.d * dy];
  }

  draw(t: number) {
    if (!this.resize()) return;
    const ctx = this.ctx, w = this.w, h = this.h;
    const cs = getComputedStyle(this.stage);
    const ink = cs.getPropertyValue("--trk").trim() || "rgba(146,146,146,.42)";
    const hi = cs.getPropertyValue("--trk-hi").trim() || "rgba(190,190,190,.52)";
    const unit = Math.min(w, h);

    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, w, h);

    /* punch the type out of everything below */
    const keep = new Path2D();
    keep.rect(0, 0, w, h);
    for (const lay of this.lays) {
      const b = this.boxOf(lay);
      const pad = Math.max(10, unit * 0.018);
      keep.rect(b.x - pad, b.y - pad, b.w + pad * 2, b.h + pad * 2);
    }
    ctx.save();
    ctx.clip(keep, "evenodd");

    ctx.lineWidth = 1;
    ctx.lineJoin = "round";
    const fs = Math.max(8, Math.round(unit * 0.0105));
    ctx.font = fs + "px 'VT323', ui-monospace, monospace";
    if ("letterSpacing" in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = "0.10em";
    ctx.textBaseline = "alphabetic";

    this.drawMarks(ctx, t, ink, hi, unit, fs);
    this.drawNodes(ctx, t, ink, hi, w, h, unit);

    ctx.restore();
  }

  drawMarks(ctx: CanvasRenderingContext2D, t: number, ink: string, hi: string, unit: number, fs: number) {
    const brk = unit * 0.022;
    const nodeR = Math.max(1.6, unit * 0.0026);

    this.marks.forEach((mk, i) => {
      if (mk.el.classList.contains("rev") && !mk.el.classList.contains("is-shown")) return;
      const b = this.boxOf(mk.el);
      if (!b.w) return;

      /* the sub-pixel unrest of a real solve — never more than a third of a pixel */
      const jx = Math.sin(t * 0.0011 + i * 2.1) * 0.34;
      const jy = Math.cos(t * 0.0009 + i * 1.3) * 0.34;

      mk.blobs.forEach((blob, k) => {
        const n = blob.p.length;

        /* contour as a slow dashed scan */
        ctx.save();
        ctx.strokeStyle = ink;
        ctx.setLineDash([unit * 0.008, unit * 0.011]);
        ctx.lineDashOffset = -(t * 0.014) % 1e6;
        ctx.beginPath();
        for (let j = 0; j < n; j++) {
          const q = this.mapPt(b, blob.p[j][0], blob.p[j][1]);
          if (j) ctx.lineTo(q[0] + jx, q[1] + jy);
          else ctx.moveTo(q[0] + jx, q[1] + jy);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.restore();

        /* vertex nodes — every other one, so it stays airy */
        ctx.save();
        ctx.strokeStyle = hi;
        for (let v = 0; v < n; v += 2) {
          const pt = this.mapPt(b, blob.p[v][0], blob.p[v][1]);
          ctx.strokeRect(
            Math.round(pt[0] + jx - nodeR) + 0.5, Math.round(pt[1] + jy - nodeR) + 0.5,
            nodeR * 2, nodeR * 2,
          );
        }
        ctx.restore();

        /* corner brackets on the blob box */
        const c0 = this.mapPt(b, blob.b[0], blob.b[1]);
        const c1 = this.mapPt(b, blob.b[0] + blob.b[2], blob.b[1]);
        const c2 = this.mapPt(b, blob.b[0] + blob.b[2], blob.b[1] + blob.b[3]);
        const c3 = this.mapPt(b, blob.b[0], blob.b[1] + blob.b[3]);
        const corners = [c0, c1, c2, c3];
        ctx.save();
        ctx.strokeStyle = ink;
        ctx.beginPath();
        for (let ci = 0; ci < 4; ci++) {
          const cur = corners[ci];
          const prev = corners[(ci + 3) % 4];
          const next = corners[(ci + 1) % 4];
          this.arm(ctx, cur, prev, brk, jx, jy);
          this.arm(ctx, cur, next, brk, jx, jy);
        }
        ctx.stroke();
        ctx.restore();

        /* readout on the first blob only */
        if (k === 0) {
          const conf = (0.938 + 0.058 * (0.5 + 0.5 * Math.sin(t * 0.00042 + i * 3.7))).toFixed(3);
          const lx = Math.min(c0[0], c3[0]) + jx;
          const ly = Math.min(c0[1], c1[1]) + jy - fs * 0.62;
          ctx.save();
          ctx.fillStyle = hi;
          ctx.fillText(mk.id, lx, ly);
          ctx.fillStyle = ink;
          ctx.fillText(conf, lx + ctx.measureText(mk.id).width + fs * 0.7, ly);
          ctx.restore();
        }
      });
    });
  }

  arm(ctx: CanvasRenderingContext2D, from: [number, number], to: [number, number], len: number, jx: number, jy: number) {
    const dx = to[0] - from[0], dy = to[1] - from[1];
    const d = Math.hypot(dx, dy) || 1;
    const l = Math.min(len, d * 0.34);
    ctx.moveTo(from[0] + jx, from[1] + jy);
    ctx.lineTo(from[0] + jx + (dx / d) * l, from[1] + jy + (dy / d) * l);
  }

  drawNodes(ctx: CanvasRenderingContext2D, t: number, ink: string, hi: string, w: number, h: number, unit: number) {
    const pts: [number, number, number][] = this.nodes.map((nd) => {
      const a = nd.a + nd.av * t * 0.001;
      const wob = 1 + Math.sin(nd.wp + t * 0.001 * nd.wv) * nd.wob;
      return [
        w * 0.5 + Math.cos(a) * nd.rx * wob * w,
        h * 0.5 + Math.sin(a) * nd.ry * wob * h,
        nd.s,
      ];
    });

    /* links between neighbours that drifted close */
    const maxD = unit * 0.30;
    ctx.save();
    ctx.lineWidth = 1;
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const d = Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]);
        if (d > maxD) continue;
        ctx.globalAlpha = 0.55 * (1 - d / maxD);
        ctx.strokeStyle = ink;
        ctx.beginPath();
        ctx.moveTo(pts[i][0], pts[i][1]);
        ctx.lineTo(pts[j][0], pts[j][1]);
        ctx.stroke();
      }
    }
    ctx.restore();

    /* nodes — hairline crosshair inside a small open box */
    ctx.save();
    ctx.lineWidth = 1;
    for (const p of pts) {
      const x = Math.round(p[0]) + 0.5, y = Math.round(p[1]) + 0.5;
      const r = Math.max(2.5, unit * 0.0042) * p[2];
      const cr = r * 2.1;
      ctx.strokeStyle = ink;
      ctx.beginPath();
      ctx.moveTo(x - cr, y); ctx.lineTo(x - r * 0.6, y);
      ctx.moveTo(x + r * 0.6, y); ctx.lineTo(x + cr, y);
      ctx.moveTo(x, y - cr); ctx.lineTo(x, y - r * 0.6);
      ctx.moveTo(x, y + r * 0.6); ctx.lineTo(x, y + cr);
      ctx.stroke();
      ctx.strokeStyle = hi;
      ctx.strokeRect(x - r, y - r, r * 2, r * 2);
    }
    ctx.restore();
  }
}

export function initTrackers(reduce: boolean): () => void {
  if (!document.querySelector(".stage")) return () => {};
  const stages = Array.from(document.querySelectorAll<HTMLElement>(".stage"));
  const overlays = stages.map((s, i) => new Overlay(s, i));

  let io: IntersectionObserver | null = null;
  if ("IntersectionObserver" in window) {
    io = new IntersectionObserver(
      (es) => {
        es.forEach((e) => {
          const o = overlays.find((x) => x.stage === e.target);
          if (!o) return;
          o.on = e.isIntersecting;
          if (e.isIntersecting) o.cv.classList.add("is-on");
        });
      },
      { rootMargin: "10% 0px" },
    );
    overlays.forEach((o) => io!.observe(o.stage));
  } else {
    overlays.forEach((o) => {
      o.on = true;
      o.cv.classList.add("is-on");
    });
  }

  let raf = 0;
  const tick = (t: number) => {
    for (const o of overlays) if (o.on) o.draw(t);
    raf = requestAnimationFrame(tick);
  };

  const paintAll = () => {
    overlays.forEach((o) => {
      o.on = true;
      o.cv.classList.add("is-on");
      o.draw(0);
    });
  };

  let stop = false;
  const start = () => {
    if (stop) return;
    if (reduce) {
      paintAll();
      window.addEventListener("resize", paintAll, { passive: true });
      window.addEventListener("scroll", paintAll, { passive: true });
    } else {
      raf = requestAnimationFrame(tick);
    }
  };

  if (document.fonts && document.fonts.ready) document.fonts.ready.then(start, start);
  else start();

  return () => {
    stop = true;
    if (raf) cancelAnimationFrame(raf);
    if (io) io.disconnect();
    overlays.forEach((o) => o.cv.remove());
  };
}
