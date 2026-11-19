import { FEEL_SCALES, type FeelRanges, type FeelKey } from "../data/feel";
import type { FeelStat, Song } from "../data/types";
import type { Cube, CubeBox } from "./cube";

export type Rgb = [number, number, number];

/** The colors the drawing needs, read from the page's CSS variables (so the graphs follow dark mode). */
export interface Palette {
  /** grey, the color at the mean */
  mut: Rgb;
  cool: Rgb;
  warm: Rgb;
  acc: string;
  line: string;
  mutS: string;
  fg: string;
}

export const mixColor = (a: Rgb, b: Rgb, t: number): string => `rgb(${[0, 1, 2].map((i) => Math.round(a[i]! + (b[i]! - a[i]!) * t)).join(",")})`;

/** A color for a score: cool below the mean of its scale, warm above, grey at the mean (full color at ±2.5 stdev). null = no score. */
export function devColor(v: number | null | undefined, stat: Pick<FeelStat, "mean" | "sd">, P: Palette): string | null {
  if (v == null) return null;
  const t = Math.max(-1, Math.min(1, stat.sd ? (v - stat.mean) / stat.sd / 2.5 : 0));
  return mixColor(P.mut, t > 0 ? P.warm : P.cool, Math.abs(t));
}

/** A small fixed offset per song and axis (independent between axes), in -0.5..0.5: scores are whole numbers, so dots would otherwise sit on top of each other. */
export function jit(ix: number, axis: number): number {
  let h = (Math.imul(ix + 1, 374761393) + Math.imul(axis + 1, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296 - 0.5;
}

/** One line of the statistics block: a scale or axis, and where the songs in the list stand against all rated songs. */
export interface StatDef {
  name: string;
  get: (s: Song) => number | null;
  /** mean and spread over all rated songs */
  m: number;
  sd: number;
  /** decimals to show */
  dp: number;
}

export interface AxisLabel {
  name: string;
  lowT: string;
  highT: string;
  /** short ends, for the 2D plots */
  ls: string;
  hs: string;
}

/**
 * What the two graph tabs share: Feel Axes is the three principal components (kind "cube"); Raw Feel with "Show graph" plots the first four
 * narrowed scales (kind "feel": up to three axes, the fourth colors the dots). A model says how many axes there are, where each song sits,
 * its color, the slider box, and which scales the statistics block reports.
 */
export interface GraphModel {
  kind: "cube" | "feel";
  n: number;
  colorName: string | null;
  /** the extent of each axis, and the slider box inside it */
  lo: number[];
  hi: number[];
  box: [number, number][];
  ax: AxisLabel[];
  /** can this song be drawn (does it have the scores)? */
  has: (s: Song) => boolean;
  pos: (s: Song, axis: number) => number;
  color: (s: Song, P: Palette) => string | null;
  stats: () => StatDef[];
  /** scales in the filter but not plotted (Raw Feel with more than four narrowed) */
  extra: string[];
  /** the scales shown on a dot's hover text */
  dotText: (s: Song) => string;
}

const label = (i: number): string => FEEL_SCALES[i]!.label;
const scoreOf = (s: Song, i: number): number | null => s.feel?.[i] ?? null;
const statOf = (stats: Record<string, FeelStat>, key: FeelKey): FeelStat => stats[key] ?? { n: 0, mean: 0, sd: 0 };

export function cubeModel(cube: Cube, box: CubeBox, feelStats: Record<string, FeelStat>): GraphModel {
  const maturity = statOf(feelStats, "maturity");
  return {
    kind: "cube",
    n: 3,
    colorName: "maturity",
    lo: cube.lo,
    hi: cube.hi,
    box: box.ranges,
    ax: cube.axes.map((a) => ({
      name: a.name, lowT: a.low, highT: a.high, ls: a.low.split(" · ")[0] ?? a.low, hs: a.high.split(" · ")[0] ?? a.high,
    })),
    has: (s) => !!cube.coords[s.ix],
    pos: (s, i) => cube.coords[s.ix]![i]! + cube.jitter[s.ix]![i]!,
    color: (s, P) => devColor(scoreOf(s, 9), maturity, P),
    stats: () => [
      ...cube.axes.map((a, i): StatDef => ({ name: a.name, get: (s) => cube.coords[s.ix]?.[i] ?? null, m: cube.mean[i]!, sd: cube.sd[i]!, dp: 2 })),
      { name: "Maturity", get: (s) => scoreOf(s, 9), m: maturity.mean, sd: maturity.sd, dp: 1 },
    ],
    extra: [],
    dotText: (s) => `${s.artist} — ${s.name}   (maturity ${scoreOf(s, 9) ?? "n/a"})`,
  };
}

/** The Raw Feel graph: the first three narrowed scales are the axes, the fourth colors the dots. `order` is the order they were narrowed. */
export function feelModel(order: readonly number[], ranges: FeelRanges, feelStats: Record<string, FeelStat>): GraphModel {
  const dims = order.slice(0, 4);
  const axd = dims.slice(0, 3);
  const cd = dims.length > 3 ? dims[3]! : null;
  const stat = (i: number) => statOf(feelStats, FEEL_SCALES[i]!.key);
  return {
    kind: "feel",
    n: axd.length,
    colorName: cd == null ? null : label(cd),
    lo: axd.map(() => -0.6),
    hi: axd.map(() => 10.6),
    box: axd.map((i): [number, number] => [(ranges[i]?.[0] ?? 0) - 0.5, (ranges[i]?.[1] ?? 10) + 0.5]), // scores are whole numbers: the box wraps the first and last one
    ax: axd.map((i) => ({ name: label(i), lowT: "0", highT: `${label(i)} 10`, ls: "0", hs: "10" })),
    has: (s) => !!s.feel && axd.every((i) => s.feel![i] != null),
    pos: (s, i) => s.feel![axd[i]!]! + jit(s.ix, i) * 0.5,
    color: cd == null ? (_s, P) => `rgb(${P.mut.join(",")})` : (s, P) => devColor(scoreOf(s, cd), stat(cd), P),
    stats: () =>
      (dims.length ? dims : FEEL_SCALES.map((_, i) => i)).map((i): StatDef => ({ name: label(i), get: (s) => scoreOf(s, i), m: stat(i).mean, sd: stat(i).sd, dp: 1 })),
    extra: order.slice(4).map(label),
    dotText: (s) => `${s.artist} — ${s.name}   (${dims.map((i) => `${label(i)} ${scoreOf(s, i) ?? "n/a"}`).join(" · ")})`,
  };
}

/** The result of one statistics line: the mean of the listed songs, its distance from the mean of all rated songs, and that in standard deviations. */
export interface StatLine extends StatDef {
  n: number;
  mean: number | null;
  d: number | null;
  z: number;
}

export function selectionStats(rows: readonly Song[], defs: readonly StatDef[]): StatLine[] {
  return defs.map((def) => {
    let n = 0;
    let sum = 0;
    for (const s of rows) {
      const v = def.get(s);
      if (v != null) {
        n++;
        sum += v;
      }
    }
    const mean = n ? sum / n : null;
    const d = mean == null ? null : mean - def.m;
    const z = n && def.sd && d != null ? d / def.sd : 0;
    return { ...def, n, mean, d, z };
  });
}

/** "+0.42" or "−0.42" (a minus sign only if the rounded number is not zero). */
export function signed(x: number, dp: number): string {
  const t = Math.abs(x).toFixed(dp);
  return (x < 0 && +t ? "−" : "+") + t;
}

/** A number without a "-0.00". */
export function plain(x: number, dp: number): string {
  const t = x.toFixed(dp);
  return +t ? t : (0).toFixed(dp);
}
