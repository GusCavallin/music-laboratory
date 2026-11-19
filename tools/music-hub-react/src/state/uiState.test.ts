import { describe, expect, it } from "vitest";
import { noFacet, noSort } from "../data/filter";
import { fixtureLibrary } from "../data/fixture";
import { buildDataset } from "../data/load";
import { buildCube, fullBox } from "../feel/cube";
import { archiveFilterOf, hasFilters, initialUiState, reduce, songFilterOf, type Action, type UiState } from "./uiState";

const run = (actions: Action[], from: UiState = initialUiState()) => actions.reduce(reduce, from);

describe("simple filters", () => {
  it("each control changes only its own value", () => {
    const s = run([
      { type: "query", value: "rock" }, { type: "starsFrom", value: 3 }, { type: "starsTo", value: 4 }, { type: "loved", value: true },
      { type: "decade", value: "1990s" }, { type: "country", value: "US" }, { type: "playlist", value: "Road Trip" },
    ]);
    expect(s).toMatchObject({ query: "rock", stars: [3, 4], lovedOnly: true, decade: "1990s", country: "US", playlist: "Road Trip" });
    expect(s.tab).toBe("itunes");
  });
  it("does not change the state it was given", () => {
    const before = initialUiState();
    reduce(before, { type: "query", value: "x" });
    expect(before).toEqual(initialUiState());
  });
});

describe("tabs", () => {
  it("a new tab starts unsorted; filters and the search stay", () => {
    const s = run([{ type: "query", value: "abba" }, { type: "sort", key: "name" }, { type: "tab", tab: "archive" }]);
    expect(s.tab).toBe("archive");
    expect(s.sort).toEqual(noSort());
    expect(s.query).toBe("abba");
  });
  it("choosing the same tab again changes nothing (not even the sort)", () => {
    const s = run([{ type: "sort", key: "name" }]);
    expect(reduce(s, { type: "tab", tab: "itunes" })).toBe(s);
  });
  it("a CD chip is dropped when leaving the archive; artist and album chips stay", () => {
    const s = run([
      { type: "tab", tab: "archive" }, { type: "facet", kind: "volume", value: "Mp3_1S", keep: true },
      { type: "facet", kind: "artist", value: "a-ha", keep: true }, { type: "tab", tab: "itunes" },
    ]);
    expect(s.facet).toEqual({ artist: "a-ha", album: null, volume: null });
  });
});

describe("clicking an artist, album or CD cell", () => {
  const busy = run([
    { type: "query", value: "love" }, { type: "starsFrom", value: 4 }, { type: "loved", value: true },
    { type: "decade", value: "1980s" }, { type: "sort", key: "name" },
  ]);
  it("a plain click replaces the other filters and keeps the sort", () => {
    const s = reduce(busy, { type: "facet", kind: "artist", value: "a-ha", keep: false });
    expect(s.facet).toEqual({ artist: "a-ha", album: null, volume: null });
    expect(s).toMatchObject({ query: "", stars: [0, 5], lovedOnly: false, decade: "" });
    expect(s.sort).toEqual({ key: "name", desc: false });
  });
  it("a plain click also replaces an earlier chip", () => {
    const s = run([
      { type: "facet", kind: "artist", value: "a-ha", keep: false }, { type: "facet", kind: "album", value: "Scoundrel Days", keep: false },
    ]);
    expect(s.facet).toEqual({ artist: null, album: "Scoundrel Days", volume: null });
  });
  it("Ctrl-click keeps the other filters and adds the chip", () => {
    const s = reduce(busy, { type: "facet", kind: "album", value: "Hunting High and Low", keep: true });
    expect(s).toMatchObject({ query: "love", stars: [4, 5], lovedOnly: true, decade: "1980s" });
    expect(s.facet.album).toBe("Hunting High and Low");
  });
  it("removing a chip leaves the rest", () => {
    const s = run([
      { type: "facet", kind: "artist", value: "a-ha", keep: true }, { type: "facet", kind: "album", value: "X", keep: true },
      { type: "removeFacet", kind: "artist" },
    ]);
    expect(s.facet).toEqual({ artist: null, album: "X", volume: null });
  });
});

describe("clear filters", () => {
  it("resets every filter and chip, and keeps the tab and the sort", () => {
    const s = run([
      { type: "tab", tab: "archive" }, { type: "sort", key: "category" }, { type: "query", value: "x" }, { type: "category", value: "Kids" },
      { type: "inItunes", value: "out" }, { type: "facet", kind: "volume", value: "Mp3_1S", keep: true }, { type: "clear" },
    ]);
    expect(s).toMatchObject({ tab: "archive", query: "", category: "", inItunes: "any", facet: noFacet() });
    expect(s.sort).toEqual({ key: "category", desc: false });
    expect(hasFilters(s)).toBe(false);
  });
});

describe("sorting", () => {
  it("the first click on most columns sorts A to Z, the next reverses, the next flips back", () => {
    const one = run([{ type: "sort", key: "name" }]);
    expect(one.sort).toEqual({ key: "name", desc: false });
    const two = reduce(one, { type: "sort", key: "name" });
    expect(two.sort).toEqual({ key: "name", desc: true });
    expect(reduce(two, { type: "sort", key: "name" }).sort).toEqual({ key: "name", desc: false });
  });
  it("rating, plays, hearts and the Feel scores go highest first", () => {
    for (const key of ["stars", "plays", "loved", "f_maturity", "f_conf"]) {
      expect(run([{ type: "sort", key }]).sort).toEqual({ key, desc: true });
    }
  });
  it("switching column starts from that column's own first direction", () => {
    const s = run([{ type: "sort", key: "name" }, { type: "sort", key: "name" }, { type: "sort", key: "stars" }]);
    expect(s.sort).toEqual({ key: "stars", desc: true });
    expect(reduce(s, { type: "sort", key: "year" }).sort).toEqual({ key: "year", desc: false });
  });
});

describe("selectors", () => {
  it("build the filters the data layer takes, with an optional search text", () => {
    const s = run([{ type: "query", value: "typed" }, { type: "starsFrom", value: 2 }, { type: "tab", tab: "archive" }, { type: "category", value: "Rock" }]);
    expect(songFilterOf(s)).toMatchObject({ query: "typed", stars: [2, 5], feel: null });
    expect(songFilterOf(s, "earlier")).toMatchObject({ query: "earlier" });
    expect(archiveFilterOf(s)).toEqual({ query: "typed", category: "Rock", inItunes: "any", facet: noFacet() });
  });
  it("hasFilters notices each kind of filter", () => {
    expect(hasFilters(initialUiState())).toBe(false);
    for (const a of [
      { type: "query", value: "a" }, { type: "starsFrom", value: 1 }, { type: "starsTo", value: 4 }, { type: "loved", value: true },
      { type: "decade", value: "1990s" }, { type: "country", value: "US" }, { type: "playlist", value: "P" }, { type: "category", value: "K" },
      { type: "inItunes", value: "in" }, { type: "facet", kind: "artist", value: "x", keep: true },
    ] as Action[]) {
      expect(hasFilters(reduce(initialUiState(), a))).toBe(true);
    }
  });
});

describe("Raw Feel and Feel Axes", () => {
  const power = 5;
  const bounds: [number, number][] = [[-2, 2], [-3, 3], [-1, 4]];

  it("the Feel sliders, links, confidence, graph switch and color are part of the state", () => {
    const s = run([
      { type: "feelRange", index: power, which: "lo", value: 6 }, { type: "feelLink", pair: "Calm" },
      { type: "feelConfidence", value: "high" }, { type: "feelGraph", value: true }, { type: "feelColor", value: "raw" },
    ]);
    expect(s.feel.ranges[power]).toEqual([6, 10]);
    expect(s.feel).toMatchObject({ linked: ["Calm"], confidence: "high", graph: true, color: "raw", order: [power] });
  });
  it("Clear filters resets the sliders and the cube box, and keeps the links and the graph switch", () => {
    const s = run([
      { type: "feelRange", index: power, which: "lo", value: 6 }, { type: "feelLink", pair: "Awe" }, { type: "feelGraph", value: true },
      { type: "cubeRange", index: 0, which: "lo", value: 0.5, bounds }, { type: "cubeRange", index: "m", which: "lo", value: 4, bounds }, { type: "clear" },
    ]);
    expect(s.feel.ranges[power]).toEqual([0, 10]);
    expect(s.feel).toMatchObject({ linked: ["Awe"], graph: true, order: [] });
    expect(s.cube).toMatchObject({ ranges: null, maturity: [0, 10] });
    expect(hasFilters(s)).toBe(false);
  });
  it("Reset sliders puts the ranges back but not the cube box", () => {
    const s = run([{ type: "feelRange", index: power, which: "hi", value: 3 }, { type: "cubeRange", index: 1, which: "hi", value: 1, bounds }, { type: "feelReset" }]);
    expect(s.feel.ranges[power]).toEqual([0, 10]);
    expect(s.cube.ranges).not.toBeNull();
  });
  it("narrowed sliders count as a filter", () => {
    expect(hasFilters(run([{ type: "feelRange", index: power, which: "lo", value: 1 }]))).toBe(true);
    expect(hasFilters(run([{ type: "feelConfidence", value: "low" }]))).toBe(true);
    expect(hasFilters(run([{ type: "cubeRange", index: 2, which: "lo", value: 0, bounds }]))).toBe(true);
    expect(hasFilters(run([{ type: "cubeRange", index: "m", which: "hi", value: 8, bounds }]))).toBe(true);
  });

  describe("the cube box", () => {
    it("the first move starts from the whole cube and changes only that end", () => {
      const s = run([{ type: "cubeRange", index: 1, which: "lo", value: -1.04, bounds }]);
      expect(s.cube.ranges).toEqual([[-2, 2], [-1, 3], [-1, 4]]);
    });
    it("an end pushed past the other drags it along", () => {
      let s = run([{ type: "cubeRange", index: 0, which: "hi", value: 0, bounds }]);
      s = reduce(s, { type: "cubeRange", index: 0, which: "lo", value: 1, bounds });
      expect(s.cube.ranges![0]).toEqual([1, 1]);
      s = reduce(s, { type: "cubeRange", index: 0, which: "hi", value: -1, bounds });
      expect(s.cube.ranges![0]).toEqual([-1, -1]);
    });
    it("maturity moves in whole numbers between 0 and 10", () => {
      let s = run([{ type: "cubeRange", index: "m", which: "lo", value: 3.6, bounds }]);
      expect(s.cube.maturity).toEqual([4, 10]);
      s = reduce(s, { type: "cubeRange", index: "m", which: "hi", value: 2, bounds });
      expect(s.cube.maturity).toEqual([2, 2]);
      expect(reduce(s, { type: "cubeRange", index: "m", which: "hi", value: 99, bounds }).cube.maturity).toEqual([2, 10]);
    });
    it("Reset box makes it the whole cube again", () => {
      const s = run([{ type: "cubeRange", index: 0, which: "lo", value: 1, bounds }, { type: "cubeRange", index: "m", which: "lo", value: 5, bounds }, { type: "cubeReset" }]);
      expect(s.cube).toMatchObject({ ranges: null, maturity: [0, 10] });
    });
    it("the view (cube or flat) is kept", () => {
      expect(run([{ type: "cubeView", value: "flat" }]).cube.view).toBe("flat");
    });
  });

  describe("tabs and columns", () => {
    it("turning the graph on drops a sort on a score column, which the graph hides", () => {
      const s = run([{ type: "tab", tab: "feel" }, { type: "sort", key: "f_power" }, { type: "feelGraph", value: true }]);
      expect(s.sort).toEqual(noSort());
    });
    it("but keeps a sort on a column that is still there", () => {
      const s = run([{ type: "tab", tab: "feel" }, { type: "sort", key: "artist" }, { type: "feelGraph", value: true }]);
      expect(s.sort).toEqual({ key: "artist", desc: false });
    });
    it("switching to a Feel tab starts unsorted", () => {
      expect(run([{ type: "sort", key: "name" }, { type: "tab", tab: "cube" }]).sort).toEqual(noSort());
    });
  });

  describe("the filter a Feel tab builds", () => {
    const cube = buildCube(buildDataset(fixtureLibrary()).songs, buildDataset(fixtureLibrary()).axes)!;
    it("Raw Feel passes the sliders and the confidence to the data layer", () => {
      const s = run([{ type: "tab", tab: "feel" }, { type: "feelRange", index: power, which: "lo", value: 6 }, { type: "feelConfidence", value: "medium" }]);
      const f = songFilterOf(s);
      expect(f.feel).toEqual({ ranges: s.feel.ranges, confidence: 2 });
      expect(f.cube).toBeNull();
    });
    it("Feel Axes passes the box (the whole cube until a slider moves)", () => {
      const s = run([{ type: "tab", tab: "cube" }]);
      const f = songFilterOf(s, s.query, cube);
      expect(f.feel).toBeNull();
      expect(f.cube?.box).toEqual(fullBox(cube));
      const moved = run([{ type: "tab", tab: "cube" }, { type: "cubeRange", index: 0, which: "lo", value: 0.5, bounds: fullBox(cube).ranges }]);
      expect(songFilterOf(moved, "", cube).cube?.box.ranges[0]).toEqual([0.5, cube.hi[0]]);
    });
    it("the plain iTunes tab uses neither", () => {
      const f = songFilterOf(initialUiState());
      expect(f.feel).toBeNull();
      expect(f.cube).toBeNull();
    });
  });
});
