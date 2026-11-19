import type { Song } from "../data/types";
import { jit, type GraphModel, type Palette, type Rgb } from "./model";
import { makeProjector, normalize, type Camera } from "./project";

/** A dot as drawn: where it landed on the canvas (for hovering and picking), and which song it is. */
export interface Dot {
  x: number;
  y: number;
  r: number;
  song: Song;
}

const TAU = 6.2832;

const hex = (h: string): Rgb => {
  let s = h.replace("#", "");
  if (s.length === 3) s = [...s].map((c) => c + c).join("");
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
};

/** The colors of the page, read from its CSS variables (so the graphs follow the light and dark themes). */
export function readPalette(el: Element = document.documentElement): Palette {
  const css = getComputedStyle(el);
  const v = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  return {
    mut: hex(v("--mut", "#6b7280")),
    cool: hex(v("--cool", "#2f6fed")),
    warm: hex(v("--warm", "#ee8a1d")),
    acc: v("--acc", "#2f6fed"),
    line: v("--line", "#e3e5e8"),
    mutS: v("--mut", "#6b7280"),
    fg: v("--fg", "#111"),
    bg: v("--bg", "#fff"),
  };
}

/** Sizes the canvas to its box at the screen's pixel density and returns its drawing context (null where a canvas can't draw). */
export function sizeCanvas(cv: HTMLCanvasElement): { w: number; h: number; g: CanvasRenderingContext2D } | null {
  const r = cv.getBoundingClientRect();
  const d = window.devicePixelRatio || 1;
  const w = Math.max(10, Math.round(r.width * d));
  const h = Math.max(10, Math.round(r.height * d));
  if (cv.width !== w || cv.height !== h) {
    cv.width = w;
    cv.height = h;
  }
  const g = cv.getContext("2d");
  if (!g) return null;
  g.setTransform(d, 0, 0, d, 0, 0);
  return { w: r.width, h: r.height, g };
}

/** The songs the model can draw: bright when they are in the list (they pass every filter), dim when something filters them out. */
export function splitDots(songs: readonly Song[], model: GraphModel, lit: ReadonlySet<number>): { bright: Song[]; dim: Song[] } {
  const bright: Song[] = [];
  const dim: Song[] = [];
  for (const s of songs) if (model.has(s)) (lit.has(s.ix) ? bright : dim).push(s);
  return { bright, dim };
}

/** The nearest dot within a few pixels of the pointer (a later dot is drawn on top, so it wins a tie). */
export function pickDot(dots: readonly Dot[], x: number, y: number): Song | null {
  let best: Song | null = null;
  let bd = Infinity;
  for (let i = dots.length - 1; i >= 0; i--) {
    const d = dots[i]!;
    const dist = (d.x - x) ** 2 + (d.y - y) ** 2;
    if (dist <= (d.r + 4) ** 2 && dist < bd) {
      bd = dist;
      best = d.song;
    }
  }
  return best;
}

const dimFill = (P: Palette) => `rgba(${P.mut.join(",")},0.2)`;

/** The bright blue ring around the song that is playing (even when the filters dim it): a page-colored halo under it, and a soft glow. */
const NOW_RING = "#00b4ff";
function ring(g: CanvasRenderingContext2D, x: number, y: number, r: number, P: Palette) {
  const R = r + 4.5;
  g.beginPath();
  g.arc(x, y, R, 0, TAU);
  g.strokeStyle = P.bg;
  g.lineWidth = 4.5;
  g.stroke();
  g.save();
  g.shadowColor = NOW_RING;
  g.shadowBlur = 7;
  g.strokeStyle = NOW_RING;
  g.lineWidth = 1.8;
  g.beginPath();
  g.arc(x, y, R, 0, TAU);
  g.stroke();
  g.restore();
}

function dot(g: CanvasRenderingContext2D, x: number, y: number, r: number, color: string | null, P: Palette) {
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  if (color) {
    g.fillStyle = color;
    g.fill();
  } else {
    // no score: a hollow ring
    g.strokeStyle = P.mutS;
    g.lineWidth = 1;
    g.stroke();
  }
}

/** "Narrow a slider to plot it": what the Raw Feel graph says until a slider is narrowed. */
export function drawHint(cv: HTMLCanvasElement, P: Palette) {
  const c = sizeCanvas(cv);
  if (!c) return;
  const { w, h, g } = c;
  g.clearRect(0, 0, w, h);
  g.fillStyle = P.mutS;
  g.font = "14px system-ui,sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText("Narrow a slider to plot it:", w / 2, h / 2 - 12);
  g.fillText("the first four you narrow make the graph.", w / 2, h / 2 + 12);
}

const EDGES: [number, number][] = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
const FACES: number[][] = [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [3, 2, 6, 7], [0, 3, 7, 4], [1, 2, 6, 5]];

/** Three axes: the cube, turned by the camera. Returns the bright dots for hovering. */
export function draw3D(cv: HTMLCanvasElement, M: GraphModel, bright: readonly Song[], dim: readonly Song[], cam: Camera, P: Palette, now: Song | null = null): Dot[] {
  const c = sizeCanvas(cv);
  if (!c) return [];
  const { w, h, g } = c;
  g.clearRect(0, 0, w, h);
  const pr = makeProjector(w, h, cam);
  const nm = (v: number, i: number) => normalize(v, M.lo[i]!, M.hi[i]!);
  const q = (s: Song) => pr(nm(M.pos(s, 0), 0), nm(M.pos(s, 1), 1), nm(M.pos(s, 2), 2));
  const corners = (b: [number, number][]) =>
    [
      [b[0]![0], b[1]![0], b[2]![0]], [b[0]![1], b[1]![0], b[2]![0]], [b[0]![1], b[1]![1], b[2]![0]], [b[0]![0], b[1]![1], b[2]![0]],
      [b[0]![0], b[1]![0], b[2]![1]], [b[0]![1], b[1]![0], b[2]![1]], [b[0]![1], b[1]![1], b[2]![1]], [b[0]![0], b[1]![1], b[2]![1]],
    ].map((p) => pr(p[0]!, p[1]!, p[2]!));
  const edges = (pts: ReturnType<typeof corners>, style: string, width: number) => {
    g.strokeStyle = style;
    g.lineWidth = width;
    g.beginPath();
    for (const [a, b] of EDGES) {
      g.moveTo(pts[a]![0], pts[a]![1]);
      g.lineTo(pts[b]![0], pts[b]![1]);
    }
    g.stroke();
  };

  edges(corners([[-1, 1], [-1, 1], [-1, 1]]), P.line, 1); // the whole cube
  const box = [0, 1, 2].map((i): [number, number] => [nm(M.box[i]![0], i), nm(M.box[i]![1], i)]);
  const bc = corners(box);
  g.fillStyle = P.acc;
  g.globalAlpha = 0.07;
  for (const face of FACES) {
    g.beginPath();
    face.forEach((k, j) => (j ? g.lineTo(bc[k]![0], bc[k]![1]) : g.moveTo(bc[k]![0], bc[k]![1])));
    g.closePath();
    g.fill();
  }
  g.globalAlpha = 1;

  g.fillStyle = dimFill(P);
  for (const s of dim) {
    const p = q(s);
    g.fillRect(p[0] - 1, p[1] - 1, 2, 2);
  }
  const pts = bright.map((s) => ({ p: q(s), s })).sort((a, b) => a.p[2] - b.p[2]); // far dots first
  const dots: Dot[] = [];
  for (const { p, s } of pts) {
    const r = Math.max(1.8, 2.9 * p[3] * Math.min(1.4, cam.zoom));
    dot(g, p[0], p[1], r, M.color(s, P), P);
    dots.push({ x: p[0], y: p[1], r, song: s });
  }
  edges(bc, P.acc, 1.6);
  if (now && M.has(now)) {
    const p = q(now);
    ring(g, p[0], p[1], Math.max(1.8, 2.9 * p[3] * Math.min(1.4, cam.zoom)), P);
  }

  // axis lines and their end labels
  g.font = "12px system-ui,sans-serif";
  g.textBaseline = "middle";
  const label = (p: readonly number[], text: string) => {
    g.fillStyle = P.mutS;
    g.textAlign = "center";
    g.fillText(text, p[0]!, p[1]!);
  };
  M.ax.forEach((a, i) => {
    const end = (t: number) => pr(i === 0 ? t : -1, i === 1 ? t : -1, i === 2 ? t : -1);
    const p0 = end(-1);
    const p1 = end(1);
    g.strokeStyle = P.mutS;
    g.lineWidth = 1.4;
    g.beginPath();
    g.moveTo(p0[0], p0[1]);
    g.lineTo(p1[0], p1[1]);
    g.stroke();
    label(end(1.22), a.highT);
    label(end(-1.22), a.lowT);
  });
  return dots;
}

/** One or two scales: a line (a strip, dots nudged vertically) or a quadrant. Returns the dots for hovering. */
export function plot2D(cv: HTMLCanvasElement, M: GraphModel, bright: readonly Song[], dim: readonly Song[], a: number, b: number | null, P: Palette, now: Song | null = null): Dot[] {
  const c = sizeCanvas(cv);
  if (!c) return [];
  const { w, h, g } = c;
  const pad = 34;
  const line = b === null;
  g.clearRect(0, 0, w, h);
  const hh = Math.min((h - 2 * pad) / 2, 70);
  const top = line ? h / 2 - hh : pad;
  const bot = line ? h / 2 + hh : h - pad;
  const X = (v: number) => pad + ((v - M.lo[a]!) / (M.hi[a]! - M.lo[a]!)) * (w - 2 * pad);
  const Y = (v: number) => bot - ((v - M.lo[b!]!) / (M.hi[b!]! - M.lo[b!]!)) * (bot - top);
  const py = (s: Song) => (line ? h / 2 + jit(s.ix, 7) * 2 * hh * 0.9 : Y(M.pos(s, b!)));
  g.strokeStyle = P.line;
  g.lineWidth = 1;
  g.strokeRect(pad, top, w - 2 * pad, bot - top);
  const bx0 = X(M.box[a]![0]);
  const bx1 = X(M.box[a]![1]);
  const by0 = line ? top : Y(M.box[b!]![1]);
  const by1 = line ? bot : Y(M.box[b!]![0]);
  g.fillStyle = P.acc;
  g.globalAlpha = 0.08;
  g.fillRect(bx0, by0, bx1 - bx0, by1 - by0);
  g.globalAlpha = 1;
  g.fillStyle = dimFill(P);
  for (const s of dim) g.fillRect(X(M.pos(s, a)) - 1, py(s) - 1, 2, 2);
  const dots: Dot[] = [];
  for (const s of bright) {
    const x = X(M.pos(s, a));
    const y = py(s);
    dot(g, x, y, 3, M.color(s, P), P);
    dots.push({ x, y, r: 3, song: s });
  }
  if (now && M.has(now)) ring(g, X(M.pos(now, a)), py(now), 3, P);
  g.strokeStyle = P.acc;
  g.lineWidth = 1.5;
  g.strokeRect(bx0, by0, bx1 - bx0, by1 - by0);
  g.font = "11px system-ui,sans-serif";
  g.fillStyle = P.mutS;
  g.textBaseline = "middle";
  g.textAlign = "left";
  g.fillText(`◂ ${M.ax[a]!.ls}`, pad, bot + 16);
  g.textAlign = "right";
  g.fillText(`${M.ax[a]!.hs} ▸`, w - pad, bot + 16);
  g.textAlign = "center";
  g.fillText(M.ax[a]!.name + (line ? "" : `  ×  ${M.ax[b!]!.name}`), w / 2, top - 16);
  if (!line) {
    g.save();
    g.translate(pad / 2, bot);
    g.rotate(-Math.PI / 2);
    g.textAlign = "left";
    g.fillText(`◂ ${M.ax[b]!.ls}`, 0, 0);
    g.textAlign = "right";
    g.fillText(`${M.ax[b]!.hs} ▸`, bot - top, 0);
    g.restore();
  }
  return dots;
}

/** The three 2D views of the Feel Axes cube side by side (axes 0 and 1, 0 and 2, 1 and 2). Returns each one's dots. */
export function drawFlat(cvs: readonly (HTMLCanvasElement | null)[], M: GraphModel, bright: readonly Song[], dim: readonly Song[], P: Palette, now: Song | null = null): Dot[][] {
  const views: [number, number][] = [[0, 1], [0, 2], [1, 2]];
  return views.map(([a, b], k) => {
    const cv = cvs[k];
    const c = cv ? sizeCanvas(cv) : null;
    if (!c) return [];
    const { w, h, g } = c;
    const pad = 30;
    g.clearRect(0, 0, w, h);
    const X = (v: number) => pad + ((v - M.lo[a]!) / (M.hi[a]! - M.lo[a]!)) * (w - 2 * pad);
    const Y = (v: number) => h - pad - ((v - M.lo[b]!) / (M.hi[b]! - M.lo[b]!)) * (h - 2 * pad);
    g.strokeStyle = P.line;
    g.lineWidth = 1;
    g.strokeRect(pad, pad, w - 2 * pad, h - 2 * pad);
    const bx0 = X(M.box[a]![0]);
    const bx1 = X(M.box[a]![1]);
    const by0 = Y(M.box[b]![1]);
    const by1 = Y(M.box[b]![0]);
    g.fillStyle = P.acc;
    g.globalAlpha = 0.08;
    g.fillRect(bx0, by0, bx1 - bx0, by1 - by0);
    g.globalAlpha = 1;
    g.fillStyle = dimFill(P);
    for (const s of dim) g.fillRect(X(M.pos(s, a)) - 1, Y(M.pos(s, b)) - 1, 2, 2);
    const dots: Dot[] = [];
    for (const s of bright) {
      const x = X(M.pos(s, a));
      const y = Y(M.pos(s, b));
      dot(g, x, y, 2.6, M.color(s, P), P);
      dots.push({ x, y, r: 2.6, song: s });
    }
    if (now && M.has(now)) ring(g, X(M.pos(now, a)), Y(M.pos(now, b)), 2.6, P);
    g.strokeStyle = P.acc;
    g.lineWidth = 1.5;
    g.strokeRect(bx0, by0, bx1 - bx0, by1 - by0);
    g.font = "10px system-ui,sans-serif";
    g.fillStyle = P.mutS;
    g.textBaseline = "middle";
    g.textAlign = "left";
    g.fillText(`◂ ${M.ax[a]!.ls}`, pad, h - pad / 2);
    g.textAlign = "right";
    g.fillText(`${M.ax[a]!.hs} ▸`, w - pad, h - pad / 2);
    g.textAlign = "center";
    g.fillText(`${M.ax[a]!.name}  ×  ${M.ax[b]!.name}`, w / 2, pad / 2);
    g.save();
    g.translate(pad / 2, h - pad);
    g.rotate(-Math.PI / 2);
    g.textAlign = "left";
    g.fillText(`◂ ${M.ax[b]!.ls}`, 0, 0);
    g.textAlign = "right";
    g.fillText(`${M.ax[b]!.hs} ▸`, h - 2 * pad, 0);
    g.restore();
    return dots;
  });
}
