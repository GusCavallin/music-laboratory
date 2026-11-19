import { FEEL_SCALES, type FeelRanges } from "../data/feel";

/**
 * The ten sliders are stacked in five pairs of scales that move together in the ratings (r from tools/emotions/correlations.md: a note,
 * it may drift as the ratings change). A pair's link toggle makes the two sliders follow each other; sign -1 means opposite scales
 * (joyful and sadness), linked as a mirror image (0 to 4 on one is 6 to 10 on the other).
 */
export interface Pair {
  name: string;
  /** positions in FEEL_SCALES: the upper and the lower slider of the stack */
  a: number;
  b: number;
  sign: 1 | -1;
  r: number;
  /** a weak link (|r| under 0.6): grouped by meaning, drawn with a dashed pill */
  weak: boolean;
}

const at = (key: string): number => FEEL_SCALES.findIndex((s) => s.key === key);

const pair = (name: string, a: string, b: string, sign: 1 | -1, r: number): Pair => ({
  name, a: at(a), b: at(b), sign, r, weak: Math.abs(r) < 0.6,
});

export const PAIRS: readonly Pair[] = [
  pair("Awe", "wonder", "transcendence", 1, 0.93),
  pair("Calm", "peacefulness", "tenderness", 1, 0.82),
  pair("Light and dark", "joyful", "sadness", -1, -0.84),
  pair("Edge", "power", "tension", 1, 0.41),
  pair("Depth", "nostalgia", "maturity", 1, 0.4),
];

/** A slider is narrowed when it is not the full 0 to 10. */
export const isNarrowed = (r: readonly [number, number] | undefined): boolean => !!r && (r[0] > 0 || r[1] < 10);

/** The pair a scale belongs to, if its link is on. */
export const linkedPairOf = (scaleIndex: number, linked: ReadonlySet<string>): Pair | undefined =>
  PAIRS.find((p) => linked.has(p.name) && (p.a === scaleIndex || p.b === scaleIndex));

/** The partner takes the same range (or the mirror image for opposite scales). The mirror is its own inverse, so it works from either slider. */
export function syncPair(ranges: FeelRanges, p: Pair, from: "a" | "b"): FeelRanges {
  const [x, y] = from === "a" ? [p.a, p.b] : [p.b, p.a];
  const [lo, hi] = ranges[x] ?? [0, 10];
  const next: FeelRanges = ranges.map((r) => [r[0], r[1]]);
  next[y] = p.sign < 0 ? [10 - hi, 10 - lo] : [lo, hi];
  return next;
}

/** Turning a link on: the narrowed slider leads; if both are narrowed, the upper one. */
export function linkLeader(ranges: FeelRanges, p: Pair): "a" | "b" {
  return isNarrowed(ranges[p.a]) || !isNarrowed(ranges[p.b]) ? "a" : "b";
}

/**
 * The scales whose slider is narrowed, in the order they were narrowed (the first four make the graph). Scales that are no longer narrowed
 * drop out; newly narrowed ones join in scale order. Two linked sliders are one idea: only the one narrowed first counts (the other still filters).
 */
export function updateFeelOrder(prev: readonly number[], ranges: FeelRanges, linked: ReadonlySet<string>): number[] {
  const order = prev.filter((i) => isNarrowed(ranges[i]));
  FEEL_SCALES.forEach((_, i) => {
    if (isNarrowed(ranges[i]) && !order.includes(i)) order.push(i);
  });
  for (const p of PAIRS) {
    if (!linked.has(p.name)) continue;
    const ia = order.indexOf(p.a);
    const ib = order.indexOf(p.b);
    if (ia >= 0 && ib >= 0) order.splice(ia > ib ? ia : ib, 1);
  }
  return order;
}

export const pairTip = (p: Pair): string =>
  `${FEEL_SCALES[p.a]!.label} and ${FEEL_SCALES[p.b]!.label}: ${p.weak ? "weakly" : "strongly"} linked in your ratings (r ${p.r > 0 ? "+" : "−"}${Math.abs(p.r).toFixed(2)}). ` +
  `Click to link the two sliders${p.sign < 0 ? " as a mirror image (opposite scales)" : ""}: moving one moves the other. ` +
  `When you link them, the narrowed one leads (the upper one if both are).`;
