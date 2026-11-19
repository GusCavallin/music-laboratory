import type { RawAxes, RawAxis, Song } from "../data/types";

/**
 * The Feel Axes cube: every rated song as a point on the three independent axes (principal components of the nine GEMS scales, from
 * tools/emotions/axes.py). `coords` and `jitter` are indexed by the song's `ix`; unrated songs have null.
 */
export interface Cube {
  axes: RawAxis[];
  /** the bounds of each axis, rounded out to half a unit (the slider range) */
  lo: number[];
  hi: number[];
  /** mean and spread of every rated song on each axis (for the statistics block) */
  mean: number[];
  sd: number[];
  coords: (number[] | null)[];
  /** a small fixed nudge per song and axis, so songs with identical scores do not hide each other */
  jitter: (number[] | null)[];
}

/** A song's three coordinates: its z-scores on the nine scales, weighted by the axis loadings and scaled to unit variance. */
function coordinates(feel: readonly (number | null)[], a: RawAxes): number[] {
  const z = a.mean.map((m, j) => {
    const v = feel[j];
    const sd = a.sd[j] ?? 0;
    return v == null || !sd ? 0 : (v - m) / sd;
  });
  return a.axes.map((axis) => axis.loadings.reduce((sum, w, j) => sum + w * (z[j] ?? 0), 0) / Math.sqrt(axis.eigenvalue));
}

/** The same small fixed nudge for the same song every time: three values in -0.15..0.15 from a hash of its position. */
export function cubeJitter(ix: number): number[] {
  let h = (ix * 2654435761) >>> 0;
  return [0, 1, 2].map(() => {
    h = (h * 1664525 + 1013904223) >>> 0;
    return (h / 4294967296 - 0.5) * 0.3;
  });
}

export function buildCube(songs: readonly Song[], axes: RawAxes | null): Cube | null {
  if (!axes || axes.axes.length < 3) return null;
  const n = axes.axes.length;
  const coords: (number[] | null)[] = new Array(songs.length).fill(null);
  const jitter: (number[] | null)[] = new Array(songs.length).fill(null);
  const lo = new Array<number>(n).fill(Infinity);
  const hi = new Array<number>(n).fill(-Infinity);
  const sum = new Array<number>(n).fill(0);
  const sum2 = new Array<number>(n).fill(0);
  let count = 0;
  for (const s of songs) {
    if (!s.feel) continue;
    const c = coordinates(s.feel, axes);
    coords[s.ix] = c;
    jitter[s.ix] = cubeJitter(s.ix);
    count++;
    for (let i = 0; i < n; i++) {
      const v = c[i]!;
      lo[i] = Math.min(lo[i]!, v);
      hi[i] = Math.max(hi[i]!, v);
      sum[i] = sum[i]! + v;
      sum2[i] = sum2[i]! + v * v;
    }
  }
  if (!count) return null;
  const mean = sum.map((x) => x / count);
  const sd = sum2.map((x, i) => Math.sqrt(Math.max(0, x / count - mean[i]! ** 2)));
  return {
    axes: axes.axes,
    lo: lo.map((x) => Math.floor(x * 2 - 0.2) / 2),
    hi: hi.map((x) => Math.ceil(x * 2 + 0.2) / 2),
    mean,
    sd,
    coords,
    jitter,
  };
}

/** The box you size with the three axis sliders and the maturity slider. */
export interface CubeBox {
  ranges: [number, number][];
  maturity: [number, number];
}

/** Maturity (the tenth score) is empty for instrumentals, so narrowing its slider leaves them out. */
export const maturityNarrowed = (m: readonly [number, number]): boolean => m[0] > 0 || m[1] < 10;

export function passesCube(cube: Cube, song: Song, box: CubeBox): boolean {
  const c = cube.coords[song.ix];
  if (!c) return false;
  for (let i = 0; i < 3; i++) {
    const [lo, hi] = box.ranges[i] ?? [-Infinity, Infinity];
    if (c[i]! < lo || c[i]! > hi) return false;
  }
  if (maturityNarrowed(box.maturity)) {
    const m = song.feel?.[9];
    if (m == null || m < box.maturity[0] || m > box.maturity[1]) return false;
  }
  return true;
}

/** The box that holds every song. */
export const fullBox = (cube: Cube): CubeBox => ({
  ranges: [0, 1, 2].map((i) => [cube.lo[i]!, cube.hi[i]!] as [number, number]),
  maturity: [0, 10],
});
