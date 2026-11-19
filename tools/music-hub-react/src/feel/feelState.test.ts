import { describe, expect, it } from "vitest";
import { FEEL_SCALES } from "../data/feel";
import { confidenceValue, initialFeel, resetFeelSliders, setFeelRange, toggleFeelLink } from "./feelState";

const idx = (key: string) => FEEL_SCALES.findIndex((s) => s.key === key);

describe("initialFeel", () => {
  it("starts with full ranges, every confidence, no links and no graph", () => {
    const f = initialFeel();
    expect(f.ranges).toHaveLength(10);
    expect(f.ranges.every((r) => r[0] === 0 && r[1] === 10)).toBe(true);
    expect(f).toMatchObject({ confidence: "all", order: [], linked: [], graph: false, color: "dev" });
    expect(confidenceValue(f)).toBe(0);
    expect(confidenceValue({ ...f, confidence: "high" })).toBe(3);
  });
});

describe("setFeelRange", () => {
  it("moves one end of one slider and notes the scale as narrowed", () => {
    const f = setFeelRange(initialFeel(), idx("power"), "lo", 5);
    expect(f.ranges[idx("power")]).toEqual([5, 10]);
    expect(f.order).toEqual([idx("power")]);
  });
  it("a slider pushed past the other end drags it along", () => {
    let f = setFeelRange(initialFeel(), idx("joyful"), "hi", 4);
    f = setFeelRange(f, idx("joyful"), "lo", 8);
    expect(f.ranges[idx("joyful")]).toEqual([8, 8]);
    f = setFeelRange(f, idx("joyful"), "hi", 2);
    expect(f.ranges[idx("joyful")]).toEqual([2, 2]);
  });
  it("keeps the order in which scales were narrowed, and drops a scale that is full again", () => {
    let f = setFeelRange(initialFeel(), idx("sadness"), "lo", 5);
    f = setFeelRange(f, idx("wonder"), "hi", 8);
    expect(f.order).toEqual([idx("sadness"), idx("wonder")]);
    f = setFeelRange(f, idx("sadness"), "lo", 0);
    expect(f.order).toEqual([idx("wonder")]);
  });
  it("rounds to whole numbers and stays between 0 and 10", () => {
    expect(setFeelRange(initialFeel(), idx("power"), "lo", 3.7).ranges[idx("power")]).toEqual([4, 10]);
    expect(setFeelRange(initialFeel(), idx("power"), "hi", 99).ranges[idx("power")]).toEqual([0, 10]);
    expect(setFeelRange(initialFeel(), idx("power"), "lo", -5).ranges[idx("power")]).toEqual([0, 10]);
  });
  it("does not change the state it was given", () => {
    const f = initialFeel();
    setFeelRange(f, idx("power"), "lo", 5);
    expect(f.ranges[idx("power")]).toEqual([0, 10]);
    expect(f.order).toEqual([]);
  });
});

describe("links", () => {
  it("with a link on, moving either slider moves its partner", () => {
    let f = toggleFeelLink(initialFeel(), "Calm");
    expect(f.linked).toEqual(["Calm"]);
    f = setFeelRange(f, idx("tenderness"), "lo", 3);
    f = setFeelRange(f, idx("tenderness"), "hi", 8);
    expect(f.ranges[idx("peacefulness")]).toEqual([3, 8]);
    expect(f.ranges[idx("tenderness")]).toEqual([3, 8]);
    f = setFeelRange(f, idx("peacefulness"), "lo", 5);
    expect(f.ranges[idx("tenderness")]).toEqual([5, 8]);
  });
  it("the opposite pair mirrors", () => {
    let f = toggleFeelLink(initialFeel(), "Light and dark");
    f = setFeelRange(f, idx("joyful"), "hi", 4);
    expect(f.ranges[idx("sadness")]).toEqual([6, 10]);
    f = setFeelRange(f, idx("sadness"), "lo", 2);
    expect(f.ranges[idx("joyful")]).toEqual([0, 8]);
  });
  it("turning a link on makes the narrowed slider lead", () => {
    let f = setFeelRange(initialFeel(), idx("peacefulness"), "lo", 6);
    f = toggleFeelLink(f, "Calm");
    expect(f.ranges[idx("tenderness")]).toEqual([6, 10]);
    let g = setFeelRange(initialFeel(), idx("tenderness"), "hi", 4);
    g = toggleFeelLink(g, "Calm");
    expect(g.ranges[idx("peacefulness")]).toEqual([0, 4]);
  });
  it("two linked sliders count as one axis for the graph (the other still filters)", () => {
    let f = setFeelRange(initialFeel(), idx("peacefulness"), "lo", 6);
    f = toggleFeelLink(f, "Calm");
    expect(f.order).toEqual([idx("peacefulness")]);
    expect(f.ranges[idx("tenderness")]).toEqual([6, 10]);
  });
  it("turning a link off lets the sliders move on their own again", () => {
    let f = toggleFeelLink(initialFeel(), "Awe");
    f = toggleFeelLink(f, "Awe");
    expect(f.linked).toEqual([]);
    f = setFeelRange(f, idx("wonder"), "lo", 4);
    expect(f.ranges[idx("transcendence")]).toEqual([0, 10]);
  });
  it("an unknown pair changes nothing", () => {
    const f = initialFeel();
    expect(toggleFeelLink(f, "Nope")).toBe(f);
  });
});

describe("resetFeelSliders", () => {
  it("puts the ranges and the confidence back and keeps the links and the graph switch", () => {
    let f = toggleFeelLink(initialFeel(), "Calm");
    f = setFeelRange(f, idx("tenderness"), "lo", 6);
    f = { ...f, confidence: "low", graph: true };
    const r = resetFeelSliders(f);
    expect(r.ranges.every((x) => x[0] === 0 && x[1] === 10)).toBe(true);
    expect(r).toMatchObject({ confidence: "all", order: [], linked: ["Calm"], graph: true });
  });
});
