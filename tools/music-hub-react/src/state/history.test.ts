import { describe, expect, it } from "vitest";
import { MAX_HISTORY, historyReducer, initialHistory, type HistoryAction, type HistoryState } from "./history";
import { initialUiState, type UiState } from "./uiState";

const run = (actions: HistoryAction[], from: HistoryState = initialHistory()) => actions.reduce(historyReducer, from);
const artist = (value: string, keep = false): HistoryAction => ({ type: "facet", kind: "artist", value, keep });
const view = (patch: Partial<UiState>): UiState => ({ ...initialUiState(), ...patch });

describe("what is remembered", () => {
  it("a click on an artist, album or CD remembers the view it replaced", () => {
    const h = run([{ type: "query", value: "love" }, artist("a-ha")]);
    expect(h.hist).toHaveLength(1);
    expect(h.hist[0]!.query).toBe("love");
    expect(h.ui.facet.artist).toBe("a-ha");
    expect(h.ui.query).toBe("");
  });
  it("applying a preset remembers the view too", () => {
    const h = run([{ type: "query", value: "love" }, { type: "apply", view: view({ query: "from a preset" }) }]);
    expect(h.hist.map((v) => v.query)).toEqual(["love"]);
    expect(h.ui.query).toBe("from a preset");
  });
  it("ordinary changes are not remembered (typing, filters, sorting, a chip's ×)", () => {
    const h = run([
      { type: "query", value: "a" }, { type: "starsFrom", value: 3 }, { type: "sort", key: "name" }, { type: "tab", tab: "archive" }, { type: "removeFacet", kind: "artist" },
    ]);
    expect(h.hist).toEqual([]);
  });
  it("an action that changes nothing keeps the very same state", () => {
    const h = initialHistory();
    expect(historyReducer(h, { type: "tab", tab: "itunes" })).toBe(h);
  });
  it("keeps the last 20", () => {
    const h = run(Array.from({ length: MAX_HISTORY + 5 }, (_, i) => artist(`artist ${i}`, true)));
    expect(h.hist).toHaveLength(MAX_HISTORY);
  });
});

describe("back and forward", () => {
  it("back returns to the view before the click, and forward returns to the click", () => {
    const start = run([{ type: "query", value: "love" }, { type: "decade", value: "1980s" }]);
    const clicked = run([artist("a-ha")], start);
    const back = run([{ type: "back" }], clicked);
    expect(back.ui).toEqual({ ...start.ui });
    expect(back.fwd).toHaveLength(1);
    const forward = run([{ type: "forward" }], back);
    expect(forward.ui).toEqual(clicked.ui);
    expect(forward.hist).toHaveLength(1);
    expect(forward.fwd).toHaveLength(0);
  });
  it("goes back through several views, one at a time", () => {
    let h = run([artist("one"), artist("two"), artist("three")]);
    expect(h.ui.facet.artist).toBe("three");
    h = run([{ type: "back" }], h);
    expect(h.ui.facet.artist).toBe("two");
    h = run([{ type: "back" }], h);
    expect(h.ui.facet.artist).toBe("one");
    h = run([{ type: "back" }], h);
    expect(h.ui.facet.artist).toBeNull();
    expect(h.hist).toEqual([]);
  });
  it("with nothing to go back to, or forward to, nothing changes", () => {
    const h = initialHistory();
    expect(historyReducer(h, { type: "back" })).toBe(h);
    expect(historyReducer(h, { type: "forward" })).toBe(h);
  });
  it("a new click forgets what was ahead", () => {
    let h = run([artist("one"), artist("two"), { type: "back" }]);
    expect(h.fwd).toHaveLength(1);
    h = run([artist("three")], h);
    expect(h.fwd).toEqual([]);
  });
  it("a preset applied after going back also forgets what was ahead", () => {
    let h = run([artist("one"), { type: "back" }]);
    h = run([{ type: "apply", view: view({ query: "preset" }) }], h);
    expect(h.fwd).toEqual([]);
  });
  it("coming back to a view keeps the Cube / Flat choice you have now", () => {
    const h = run([{ type: "tab", tab: "cube" }, artist("a-ha"), { type: "cubeView", value: "flat" }, { type: "back" }]);
    expect(h.ui.tab).toBe("cube");
    expect(h.ui.cube.view).toBe("flat");
  });
  it("undoes a preset with back", () => {
    const before = run([{ type: "query", value: "mine" }]);
    const applied = run([{ type: "apply", view: view({ tab: "feel", query: "" }) }], before);
    expect(applied.ui.tab).toBe("feel");
    expect(run([{ type: "back" }], applied).ui.query).toBe("mine");
  });
  it("does not change the states it was given", () => {
    const h = run([artist("one")]);
    const before = JSON.stringify(h);
    run([{ type: "back" }], h);
    expect(JSON.stringify(h)).toBe(before);
  });
});
