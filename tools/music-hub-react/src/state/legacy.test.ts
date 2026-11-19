import { describe, expect, it } from "vitest";
import { FEEL_SCALES } from "../data/feel";
import { noFacet, noSort } from "../data/filter";
import { legacyToView, viewToLegacy, type LegacyView } from "./legacy";
import { initialUiState, reduce, type Action, type UiState } from "./uiState";

const idx = (key: string) => FEEL_SCALES.findIndex((s) => s.key === key);
const run = (actions: Action[], from: UiState = initialUiState()) => actions.reduce(reduce, from);

/** A saved view in the shape the current page writes (every control value a string), with made-up values. */
const saved = (over: Partial<LegacyView> & { f?: Record<string, string> } = {}): LegacyView => {
  const f: Record<string, string> = {
    q: "", pl: "", stars: "0", starsmax: "5", dec: "", cty: "", cat: "", inits: "", fl_conf: "all", fl_color: "dev",
  };
  for (const s of FEEL_SCALES) {
    f[`fl_${s.key}_lo`] = "0";
    f[`fl_${s.key}_hi`] = "10";
  }
  return { tab: "feel", loved: false, facet: { artist: null, album: null, volume: null }, g: false, fo: [], sort: { k: null, d: 0 }, ...over, f: { ...f, ...over.f } };
};

describe("legacyToView", () => {
  it("turns the strings of the stored format into the state", () => {
    const v = legacyToView(saved({
      tab: "itunes", loved: true, f: { q: "calm", pl: "Road Trip", stars: "3", starsmax: "4", dec: "1990s", cty: "US", inits: "" },
      facet: { artist: "a-ha", album: null, volume: null }, sort: { k: "stars", d: 1 },
    }));
    expect(v).toMatchObject({
      tab: "itunes", query: "calm", playlist: "Road Trip", stars: [3, 4], lovedOnly: true, decade: "1990s", country: "US", inItunes: "any",
      facet: { artist: "a-ha", album: null, volume: null }, sort: { key: "stars", desc: true },
    });
  });
  it("reads the Feel sliders, confidence, color, graph switch, narrowing order and links", () => {
    const v = legacyToView(saved({
      g: true, fo: [idx("power"), idx("joyful")], lk: ["Calm"], f: { fl_power_lo: "4", fl_joyful_hi: "3", fl_conf: "high", fl_color: "raw" },
    }));
    expect(v.feel.ranges[idx("power")]).toEqual([4, 10]);
    expect(v.feel.ranges[idx("joyful")]).toEqual([0, 3]);
    expect(v.feel).toMatchObject({ confidence: "high", color: "raw", graph: true, linked: ["Calm"], order: [idx("power"), idx("joyful")] });
  });
  it("an old confidence (1, 2 or 3) means All, as in the current page", () => {
    expect(legacyToView(saved({ f: { fl_conf: "1" } })).feel.confidence).toBe("all");
    expect(legacyToView(saved({ f: { fl_conf: "bogus" } })).feel.confidence).toBe("all");
  });
  it("the narrowing order is rebuilt from the sliders: widened scales drop out, narrowed ones missing from it join", () => {
    const v = legacyToView(saved({ fo: [idx("power"), idx("sadness")], f: { fl_wonder_lo: "2", fl_power_lo: "5" } }));
    expect(v.feel.order).toEqual([idx("power"), idx("wonder")]);
  });
  it("the Feel Axes box, and 'the whole cube' when it covers the bounds", () => {
    const cx: LegacyView["cx"] = { "0": ["-0.4", "3.5"], "1": ["-0.4", "3"], "2": ["-2.5", "5.5"], m: ["5", "10"] };
    const bounds = [[-0.4, 3.5], [-0.4, 3], [-2.5, 5.5]] as const;
    const whole = legacyToView(saved({ tab: "cube", cx }), initialUiState(), bounds);
    expect(whole.cube.ranges).toBeNull();
    expect(whole.cube.maturity).toEqual([5, 10]);
    const narrower = legacyToView(saved({ tab: "cube", cx: { ...cx, "0": ["0.5", "3.5"] } }), initialUiState(), bounds);
    expect(narrower.cube.ranges).toEqual([[0.5, 3.5], [-0.4, 3], [-2.5, 5.5]]);
    expect(legacyToView(saved({ tab: "cube", cx }), initialUiState()).cube.ranges).toEqual([[-0.4, 3.5], [-0.4, 3], [-2.5, 5.5]]); // no bounds known: kept as given
  });
  it("a sort on a column the tab does not have is dropped (the graph hides the score columns)", () => {
    expect(legacyToView(saved({ tab: "feel", sort: { k: "f_power", d: 1 } })).sort).toEqual({ key: "f_power", desc: true });
    expect(legacyToView(saved({ tab: "feel", g: true, sort: { k: "f_power", d: 1 } })).sort).toEqual(noSort());
    expect(legacyToView(saved({ tab: "archive", sort: { k: "stars", d: 0 } })).sort).toEqual(noSort());
  });
  it("sliders out of order or out of range are put right", () => {
    const v = legacyToView(saved({ f: { fl_power_lo: "9", fl_power_hi: "2", fl_wonder_hi: "99", stars: "9", starsmax: "-3" } }));
    expect(v.feel.ranges[idx("power")]).toEqual([2, 9]);
    expect(v.feel.ranges[idx("wonder")]).toEqual([0, 10]);
    expect(v.stars).toEqual([0, 5]);
  });
  it("links that are not pairs are ignored; a missing list keeps the current links", () => {
    expect(legacyToView(saved({ lk: ["Calm", "Nonsense"] })).feel.linked).toEqual(["Calm"]);
    const base = run([{ type: "feelLink", pair: "Awe" }]);
    expect(legacyToView({ ...saved(), lk: undefined }, base).feel.linked).toEqual(["Awe"]);
  });
  it("a value that is missing keeps what the current state has", () => {
    const base = run([{ type: "query", value: "kept" }, { type: "decade", value: "1980s" }]);
    const v = legacyToView({ tab: "itunes", f: { stars: "2" }, loved: false, g: false, fo: [], sort: { k: null, d: 0 } }, base);
    expect(v.query).toBe("kept");
    expect(v.decade).toBe("1980s");
    expect(v.stars[0]).toBe(2);
  });
  it("anything that is not a saved view leaves the state as it is", () => {
    const base = initialUiState();
    for (const junk of [null, undefined, 5, "text", [], true]) expect(legacyToView(junk, base)).toBe(base);
  });
  it("an unknown tab keeps the current one; an empty chip is no chip", () => {
    const base = run([{ type: "tab", tab: "cube" }]);
    expect(legacyToView({ tab: "nope", f: {}, facet: { artist: "", album: "", volume: null } }, base).tab).toBe("cube");
    expect(legacyToView({ tab: "itunes", f: {}, facet: { artist: "", album: "", volume: null } }).facet).toEqual(noFacet());
  });
});

describe("viewToLegacy", () => {
  it("writes every control value as a string, like the current page", () => {
    const ui = run([
      { type: "query", value: "love" }, { type: "starsFrom", value: 3 }, { type: "loved", value: true }, { type: "inItunes", value: "in" },
      { type: "feelRange", index: idx("power"), which: "lo", value: 6 }, { type: "feelConfidence", value: "medium" }, { type: "feelGraph", value: true },
      { type: "sort", key: "artist" },
    ]);
    const v = viewToLegacy(ui);
    expect(v.f).toMatchObject({ q: "love", stars: "3", starsmax: "5", inits: "in", fl_conf: "medium", fl_color: "dev", fl_power_lo: "6", fl_power_hi: "10", fl_wonder_lo: "0" });
    expect(Object.values(v.f).every((x) => typeof x === "string")).toBe(true);
    expect(v).toMatchObject({ tab: "itunes", loved: true, g: true, fo: [idx("power")], sort: { k: "artist", d: 0 } });
  });
  it("no iTunes choice is stored as an empty string", () => {
    expect(viewToLegacy(initialUiState()).f.inits).toBe("");
  });
  it("the Feel Axes box is written with the bounds when it is the whole cube, and left out when there is no cube", () => {
    const whole = viewToLegacy(initialUiState(), [[-1, 2], [-3, 4], [0, 5]]);
    expect(whole.cx).toEqual({ "0": ["-1", "2"], "1": ["-3", "4"], "2": ["0", "5"], m: ["0", "10"] });
    expect(viewToLegacy(initialUiState()).cx).toBeUndefined();
    const moved = run([{ type: "cubeRange", index: 1, which: "lo", value: 0.5, bounds: [[-1, 2], [-3, 4], [0, 5]] }]);
    expect(viewToLegacy(moved).cx!["1"]).toEqual(["0.5", "4"]);
  });
});

describe("round trip", () => {
  const bounds = [[-1, 2], [-3, 4], [0, 5]] as const;
  const bnds = [[-1, 2], [-3, 4], [0, 5]] as [number, number][];
  const views: [string, UiState][] = [
    ["a plain view", initialUiState()],
    ["a busy iTunes view", run([
      { type: "query", value: "wild paper" }, { type: "starsFrom", value: 2 }, { type: "starsTo", value: 4 }, { type: "loved", value: true },
      { type: "decade", value: "1990s" }, { type: "country", value: "US" }, { type: "playlist", value: "Road Trip" },
      { type: "facet", kind: "artist", value: "a-ha", keep: true }, { type: "sort", key: "stars" },
    ])],
    ["Raw Feel with links and a graph", run([
      { type: "tab", tab: "feel" }, { type: "feelLink", pair: "Calm" }, { type: "feelRange", index: idx("peacefulness"), which: "lo", value: 6 },
      { type: "feelRange", index: idx("power"), which: "hi", value: 3 }, { type: "feelConfidence", value: "high" }, { type: "feelColor", value: "raw" },
      { type: "feelGraph", value: true }, { type: "sort", key: "artist" },
    ])],
    ["Feel Axes with a box", run([
      { type: "tab", tab: "cube" }, { type: "cubeRange", index: 0, which: "lo", value: 0.5, bounds: bnds }, { type: "cubeRange", index: "m", which: "lo", value: 4, bounds: bnds },
    ])],
    ["the archive", run([{ type: "tab", tab: "archive" }, { type: "category", value: "Kids" }, { type: "inItunes", value: "out" }, { type: "facet", kind: "volume", value: "Mp3_1S", keep: true }])],
  ];
  for (const [name, ui] of views) {
    it(`${name}: saved and read back it is the same view`, () => {
      const back = legacyToView(viewToLegacy(ui, bounds), initialUiState(), bounds);
      expect(back).toEqual({ ...ui, cube: { ...ui.cube, view: back.cube.view } });
    });
    it(`${name}: stays the same through JSON, like a preset in presets.json`, () => {
      const through = JSON.parse(JSON.stringify(viewToLegacy(ui, bounds)));
      expect(legacyToView(through, initialUiState(), bounds)).toEqual(legacyToView(viewToLegacy(ui, bounds), initialUiState(), bounds));
    });
  }
});
