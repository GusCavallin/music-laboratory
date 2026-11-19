import { describe, expect, it } from "vitest";
import { FEEL_SCALES } from "../data/feel";
import { SESSION_KEY, fitToLibrary, fromSession, loadSession, toSession, writeSession, type Storage_ } from "./session";
import { initialUiState, reduce, type Action, type UiState } from "./uiState";

const idx = (key: string) => FEEL_SCALES.findIndex((s) => s.key === key);
const run = (actions: Action[], from: UiState = initialUiState()) => actions.reduce(reduce, from);
const memory = (): Storage_ & { data: Record<string, string> } => {
  const data: Record<string, string> = {};
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v) };
};

describe("toSession", () => {
  it("is the current page's format: the tab as src/feel/cube, the controls' values as strings", () => {
    const ui = run([{ type: "tab", tab: "feel" }, { type: "query", value: "calm" }, { type: "feelRange", index: idx("power"), which: "lo", value: 5 }, { type: "sort", key: "artist" }]);
    const s = toSession(ui, true, { path: "C:\\m\\a.mp3", t: 42 });
    expect(s).toMatchObject({ src: "itunes", feel: true, cube: false, shuf: true, sort: { k: "artist", d: 0 }, song: { path: "C:\\m\\a.mp3", t: 42 } });
    expect(s.f).toMatchObject({ q: "calm", fl_power_lo: "5", fl_power_hi: "10", stars: "0", starsmax: "5" });
    expect(s.fo).toEqual([idx("power")]);
  });
  it("each tab", () => {
    expect(toSession(initialUiState(), false, null)).toMatchObject({ src: "itunes", feel: false, cube: false, song: null });
    expect(toSession(run([{ type: "tab", tab: "cube" }]), false, null)).toMatchObject({ src: "itunes", feel: false, cube: true });
    expect(toSession(run([{ type: "tab", tab: "archive" }]), false, null)).toMatchObject({ src: "archive", feel: false, cube: false });
  });
  it("goes through JSON", () => {
    const s = toSession(run([{ type: "query", value: "x" }]), false, null);
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });
});

describe("fromSession", () => {
  const cases: [string, UiState][] = [
    ["the plain view", initialUiState()],
    ["a busy view", run([
      { type: "query", value: "wild" }, { type: "starsFrom", value: 3 }, { type: "loved", value: true }, { type: "decade", value: "1980s" },
      { type: "facet", kind: "album", value: "Hunting High and Low", keep: true }, { type: "sort", key: "plays" },
    ])],
    ["Raw Feel with a graph, links and a narrowed order", run([
      { type: "tab", tab: "feel" }, { type: "feelLink", pair: "Awe" }, { type: "feelRange", index: idx("wonder"), which: "lo", value: 4 },
      { type: "feelRange", index: idx("sadness"), which: "hi", value: 6 }, { type: "feelColor", value: "raw" }, { type: "feelGraph", value: true },
    ])],
    ["Feel Axes", run([{ type: "tab", tab: "cube" }, { type: "query", value: "x" }])],
    ["the archive", run([{ type: "tab", tab: "archive" }, { type: "category", value: "Kids" }])],
  ];
  for (const [name, ui] of cases) {
    it(`${name}: what was saved comes back`, () => {
      const back = fromSession(JSON.parse(JSON.stringify(toSession(ui, true, { path: "p", t: 7 }))));
      expect(back.ui).toEqual(ui);
      expect(back.shuffle).toBe(true);
      expect(back.song).toEqual({ path: "p", t: 7 });
    });
  }
  it("the Feel Axes box is not remembered: it starts as the whole cube", () => {
    const ui = run([{ type: "tab", tab: "cube" }, { type: "cubeRange", index: 0, which: "lo", value: 1, bounds: [[0, 5], [0, 5], [0, 5]] }]);
    expect(fromSession(toSession(ui, false, null)).ui.cube.ranges).toBeNull();
  });
  it("a missing or odd song, position or shuffle is handled", () => {
    expect(fromSession({ song: null }).song).toBeNull();
    expect(fromSession({ song: { path: 5 } }).song).toBeNull();
    expect(fromSession({ song: { path: "p", t: "x" } }).song).toEqual({ path: "p", t: 0 });
    expect(fromSession({ song: { path: "p", t: -4 } }).song).toEqual({ path: "p", t: 0 });
    expect(fromSession({}).shuffle).toBe(false);
  });
  it("anything that is not a session leaves the view as it is", () => {
    const base = run([{ type: "query", value: "keep" }]);
    for (const junk of [null, undefined, 3, "x"]) expect(fromSession(junk, base)).toEqual({ ui: base, shuffle: false, song: null });
  });
  it("reads a session written by the current page (src/feel/cube booleans, strings)", () => {
    const page = { src: "itunes", feel: true, cube: false, facet: { artist: null, album: null, volume: null }, sort: { k: "f_power", d: 1 }, shuf: false, loved: false, g: false, fo: [], lk: [], f: { q: "", stars: "0", starsmax: "5", fl_conf: "1" }, song: null };
    const back = fromSession(page).ui;
    expect(back).toMatchObject({ tab: "feel", sort: { key: "f_power", desc: true } });
    expect(back.feel.confidence).toBe("all");
  });
});

describe("loadSession and writeSession", () => {
  it("write then load", () => {
    const m = memory();
    const s = toSession(initialUiState(), false, null);
    writeSession(s, m);
    expect(Object.keys(m.data)).toEqual([SESSION_KEY]);
    expect(loadSession(m)).toEqual(s);
  });
  it("nothing stored, or damaged text, loads as nothing", () => {
    expect(loadSession(memory())).toBeNull();
    const m = memory();
    m.data[SESSION_KEY] = "{broken";
    expect(loadSession(m)).toBeNull();
  });
  it("a storage that refuses (private windows) neither breaks reading nor writing", () => {
    const blocked: Storage_ = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
    expect(loadSession(blocked)).toBeNull();
    expect(() => writeSession(toSession(initialUiState(), false, null), blocked)).not.toThrow();
  });
});

describe("fitToLibrary", () => {
  const library = { playlists: ["Calm"], decades: ["1980s"], countries: ["US"], categories: ["Kids"] };
  it("keeps choices the library has, and an empty choice", () => {
    const ui = run([{ type: "playlist", value: "Calm" }, { type: "decade", value: "1980s" }, { type: "country", value: "US" }, { type: "category", value: "Kids" }]);
    expect(fitToLibrary(ui, library)).toBe(ui);
    expect(fitToLibrary(initialUiState(), library)).toEqual(initialUiState());
  });
  it("drops the ones it does not, one by one", () => {
    const ui = run([{ type: "playlist", value: "Gone" }, { type: "decade", value: "1980s" }, { type: "country", value: "XX" }, { type: "category", value: "Nope" }, { type: "query", value: "keep" }]);
    const fit = fitToLibrary(ui, library);
    expect(fit).toMatchObject({ playlist: "", decade: "1980s", country: "", category: "", query: "keep" });
  });
});
