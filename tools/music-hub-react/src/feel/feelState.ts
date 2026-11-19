import { CONFIDENCE_CHOICES, fullFeelRanges, type ConfidenceChoice, type FeelRanges } from "../data/feel";
import { PAIRS, linkLeader, linkedPairOf, syncPair, updateFeelOrder } from "./pairs";

/** The controls of the Raw Feel tab. */
export interface FeelState {
  /** one range per scale, in FEEL_SCALES order */
  ranges: FeelRanges;
  confidence: ConfidenceChoice;
  /** the scales whose slider is narrowed, in the order they were narrowed (the first four make the graph) */
  order: number[];
  /** names of the pairs whose link is on (off at first) */
  linked: string[];
  /** the "Show graph" switch */
  graph: boolean;
  /** how score cells are colored: against the mean of all rated songs, or by the raw score */
  color: "dev" | "raw";
}

export const initialFeel = (): FeelState => ({
  ranges: fullFeelRanges(),
  confidence: "all",
  order: [],
  linked: [],
  graph: false,
  color: "dev",
});

/** The confidence menu's value as the number the filter takes (0 = all). */
export const confidenceValue = (f: FeelState): number => CONFIDENCE_CHOICES[f.confidence];

/**
 * Moves one end of one slider. Crossing the other end pushes it along; a linked slider moves its partner too.
 * `which` is "lo" or "hi". Returns the new state (the order of narrowed scales included).
 */
export function setFeelRange(f: FeelState, index: number, which: "lo" | "hi", value: number): FeelState {
  const v = Math.max(0, Math.min(10, Math.round(value)));
  const cur = f.ranges[index] ?? [0, 10];
  let [lo, hi] = cur;
  if (which === "lo") {
    lo = v;
    if (lo > hi) hi = lo;
  } else {
    hi = v;
    if (lo > hi) lo = hi;
  }
  let ranges: FeelRanges = f.ranges.map((r, i) => (i === index ? [lo, hi] : [r[0], r[1]]));
  const linked = new Set(f.linked);
  const p = linkedPairOf(index, linked);
  if (p) ranges = syncPair(ranges, p, p.a === index ? "a" : "b");
  return { ...f, ranges, order: updateFeelOrder(f.order, ranges, linked) };
}

/** Turns a pair's link on or off. Turning it on makes the narrowed slider lead and the partner follow. */
export function toggleFeelLink(f: FeelState, pairName: string): FeelState {
  const p = PAIRS.find((x) => x.name === pairName);
  if (!p) return f;
  if (f.linked.includes(pairName)) {
    const linked = f.linked.filter((n) => n !== pairName);
    return { ...f, linked, order: updateFeelOrder(f.order, f.ranges, new Set(linked)) };
  }
  const linked = [...f.linked, pairName];
  const ranges = syncPair(f.ranges, p, linkLeader(f.ranges, p));
  return { ...f, linked, ranges, order: updateFeelOrder(f.order, ranges, new Set(linked)) };
}

/** "Reset sliders": every scale back to 0 to 10 and every confidence. The links and the graph switch stay as they are. */
export const resetFeelSliders = (f: FeelState): FeelState => ({ ...f, ranges: fullFeelRanges(), confidence: "all", order: [] });
