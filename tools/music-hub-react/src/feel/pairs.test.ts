import { describe, expect, it } from "vitest";
import { FEEL_SCALES, fullFeelRanges } from "../data/feel";
import { PAIRS, isNarrowed, linkLeader, linkedPairOf, pairTip, syncPair, updateFeelOrder } from "./pairs";

const idx = (key: string) => FEEL_SCALES.findIndex((s) => s.key === key);
const pairNamed = (name: string) => PAIRS.find((p) => p.name === name)!;
const withRange = (key: string, range: [number, number]) => {
  const r = fullFeelRanges();
  r[idx(key)] = range;
  return r;
};

describe("PAIRS", () => {
  it("five stacks of two scales, using each of the ten scales once", () => {
    expect(PAIRS.map((p) => p.name)).toEqual(["Awe", "Calm", "Light and dark", "Edge", "Depth"]);
    expect(PAIRS.flatMap((p) => [p.a, p.b]).sort((x, y) => x - y)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });
  it("pairs the scales the correlation report says move together", () => {
    const named = (p: (typeof PAIRS)[number]) => [FEEL_SCALES[p.a]!.key, FEEL_SCALES[p.b]!.key];
    expect(named(pairNamed("Awe"))).toEqual(["wonder", "transcendence"]);
    expect(named(pairNamed("Calm"))).toEqual(["peacefulness", "tenderness"]);
    expect(named(pairNamed("Light and dark"))).toEqual(["joyful", "sadness"]);
  });
  it("marks the weak links (about 0.4) and the opposite pair", () => {
    expect(PAIRS.filter((p) => p.weak).map((p) => p.name)).toEqual(["Edge", "Depth"]);
    expect(PAIRS.filter((p) => p.sign < 0).map((p) => p.name)).toEqual(["Light and dark"]);
  });
});

describe("syncPair", () => {
  it("the partner takes the same range", () => {
    const calm = pairNamed("Calm");
    const out = syncPair(withRange("peacefulness", [6, 10]), calm, "a");
    expect(out[idx("tenderness")]).toEqual([6, 10]);
    expect(out[idx("peacefulness")]).toEqual([6, 10]);
  });
  it("opposite scales mirror, from either end", () => {
    const dark = pairNamed("Light and dark");
    expect(syncPair(withRange("joyful", [0, 4]), dark, "a")[idx("sadness")]).toEqual([6, 10]);
    expect(syncPair(withRange("sadness", [2, 10]), dark, "b")[idx("joyful")]).toEqual([0, 8]);
  });
  it("does not change the ranges it was given", () => {
    const before = withRange("wonder", [3, 5]);
    syncPair(before, pairNamed("Awe"), "a");
    expect(before[idx("transcendence")]).toEqual([0, 10]);
  });
});

describe("linkLeader", () => {
  it("the narrowed slider leads; if both are narrowed, or neither, the upper one", () => {
    const calm = pairNamed("Calm");
    expect(linkLeader(withRange("peacefulness", [6, 10]), calm)).toBe("a");
    expect(linkLeader(withRange("tenderness", [6, 10]), calm)).toBe("b");
    expect(linkLeader(fullFeelRanges(), calm)).toBe("a");
    const both = withRange("peacefulness", [6, 10]);
    both[idx("tenderness")] = [2, 3];
    expect(linkLeader(both, calm)).toBe("a");
  });
});

describe("linkedPairOf", () => {
  it("finds the pair of a scale only when its link is on", () => {
    expect(linkedPairOf(idx("tenderness"), new Set(["Calm"]))?.name).toBe("Calm");
    expect(linkedPairOf(idx("tenderness"), new Set(["Awe"]))).toBeUndefined();
    expect(linkedPairOf(idx("tenderness"), new Set())).toBeUndefined();
  });
});

describe("updateFeelOrder", () => {
  it("keeps the order in which sliders were narrowed", () => {
    const r = withRange("power", [5, 10]);
    r[idx("joyful")] = [0, 3];
    expect(updateFeelOrder([idx("joyful"), idx("power")], r, new Set())).toEqual([idx("joyful"), idx("power")]);
  });
  it("drops a scale that is full again and adds a newly narrowed one at the end", () => {
    const r = withRange("power", [5, 10]);
    expect(updateFeelOrder([idx("joyful"), idx("power")], r, new Set())).toEqual([idx("power")]);
    r[idx("wonder")] = [1, 10];
    expect(updateFeelOrder([idx("power")], r, new Set())).toEqual([idx("power"), idx("wonder")]);
  });
  it("two linked sliders count once: the one listed first stays", () => {
    const r = withRange("peacefulness", [6, 10]);
    r[idx("tenderness")] = [6, 10];
    expect(updateFeelOrder([idx("peacefulness")], r, new Set(["Calm"]))).toEqual([idx("peacefulness")]);
    expect(updateFeelOrder([], r, new Set(["Calm"]))).toEqual([idx("tenderness")]); // both new: scale order, so tenderness comes first
    expect(updateFeelOrder([idx("peacefulness")], r, new Set())).toEqual([idx("peacefulness"), idx("tenderness")]); // not linked: both count
  });
});

describe("isNarrowed and pairTip", () => {
  it("only the full range is not narrowed", () => {
    expect(isNarrowed([0, 10])).toBe(false);
    expect(isNarrowed([1, 10])).toBe(true);
    expect(isNarrowed([0, 9])).toBe(true);
  });
  it("the tip says how strong the link is and mentions the mirror for the opposite pair", () => {
    expect(pairTip(pairNamed("Calm"))).toContain("strongly linked");
    expect(pairTip(pairNamed("Calm"))).toContain("r +0.82");
    expect(pairTip(pairNamed("Edge"))).toContain("weakly linked");
    expect(pairTip(pairNamed("Light and dark"))).toContain("mirror image");
    expect(pairTip(pairNamed("Light and dark"))).toContain("r −0.84");
  });
});
