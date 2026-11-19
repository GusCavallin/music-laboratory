import { describe, expect, it } from "vitest";
import { columnsOf } from "../columns";
import {
  defaultPrefs, HIDDEN_KEY, loadPrefs, mergeOrder, moveColumn, ORDER_KEY, resetOrder, savePrefs, setColumnShown, visibleColumns, type PrefsStorage,
} from "./columnPrefs";
import { initialUiState, reduce } from "./uiState";

const memory = (): PrefsStorage & { data: Record<string, string> } => {
  const data: Record<string, string> = {};
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v) };
};
const keys = (cols: { key: string }[]) => cols.map((c) => c.key);

describe("the usual columns", () => {
  it("iTunes shows everything but the path", () => {
    const k = keys(visibleColumns("itunes", defaultPrefs()));
    expect(k).not.toContain("path");
    expect(k.slice(0, 3)).toEqual(["name", "artist", "album"]);
    expect(k).toContain("track");
  });
  it("Raw Feel shows the scores, and hides the song details", () => {
    const k = keys(visibleColumns("feel", defaultPrefs()));
    expect(k).toContain("f_wonder");
    expect(k).toContain("stars");
    expect(k).not.toContain("year");
  });
  it("Feel Axes shows maturity and plays, and not the Feel scores otherwise", () => {
    const k = keys(visibleColumns("cube", defaultPrefs()));
    expect(k).toEqual(["name", "artist", "stars", "f_maturity", "album", "plays"]);
    expect(k).not.toContain("f_wonder");
  });
});

describe("mergeOrder", () => {
  const base = ["a", "b", "c", "d", "e"];
  it("keeps a saved order", () => expect(mergeOrder(base, ["e", "d", "c", "b", "a"])).toEqual(["e", "d", "c", "b", "a"]));
  it("drops columns that no longer exist, and repeats, and junk", () => expect(mergeOrder(base, ["z", "b", "b", 3, "a", "c", "d", "e"])).toEqual(["b", "a", "c", "d", "e"]));
  it("puts a new column before the next one it knows of, in the usual order", () => {
    expect(mergeOrder(base, ["e", "a", "d"])).toEqual(["e", "a", "b", "c", "d"]);
  });
  it("puts a new last column last", () => expect(mergeOrder(["a", "b", "c"], ["b", "a"])).toEqual(["b", "a", "c"]));
  it("nothing saved: the usual order", () => expect(mergeOrder(base, [])).toEqual(base));
});

describe("hiding and showing", () => {
  it("hides a column and shows it again", () => {
    const hidden = setColumnShown(defaultPrefs(), "itunes", "year", false);
    expect(keys(visibleColumns("itunes", hidden))).not.toContain("year");
    expect(keys(visibleColumns("itunes", setColumnShown(hidden, "itunes", "year", true)))).toContain("year");
  });
  it("does not change the other column sets", () => {
    const p = setColumnShown(defaultPrefs(), "itunes", "year", false);
    expect(p.hidden.feel).toEqual(defaultPrefs().hidden.feel);
  });
  it("the last shown column stays", () => {
    let p = defaultPrefs();
    for (const c of columnsOf("archive")) p = setColumnShown(p, "archive", c.key, false);
    expect(keys(visibleColumns("archive", p))).toHaveLength(1);
    const again = setColumnShown(p, "archive", visibleColumns("archive", p)[0]!.key, false);
    expect(again).toBe(p);
  });
  it("leaves the prefs it was given alone", () => {
    const p = defaultPrefs();
    setColumnShown(p, "itunes", "year", false);
    expect(p.hidden.itunes.has("year")).toBe(false);
  });
});

describe("moving columns", () => {
  it("the dragged column takes the place of the one it lands on", () => {
    const p = moveColumn(defaultPrefs(), "itunes", "year", "name");
    expect(p.order.itunes.slice(0, 3)).toEqual(["year", "name", "artist"]);
    const q = moveColumn(defaultPrefs(), "itunes", "name", "album");
    expect(q.order.itunes.slice(0, 3)).toEqual(["artist", "album", "name"]);
  });
  it("on itself or an unknown column, nothing changes", () => {
    const p = defaultPrefs();
    expect(moveColumn(p, "itunes", "name", "name")).toBe(p);
    expect(moveColumn(p, "itunes", "name", "nope")).toBe(p);
  });
  it("Reset order puts it back, for that set only", () => {
    let p = moveColumn(moveColumn(defaultPrefs(), "itunes", "year", "name"), "feel", "stars", "name");
    p = resetOrder(p, "itunes");
    expect(p.order.itunes).toEqual(defaultPrefs().order.itunes);
    expect(p.order.feel[0]).toBe("stars");
  });
  it("hidden columns keep their place in the order", () => {
    const p = setColumnShown(moveColumn(defaultPrefs(), "itunes", "year", "name"), "itunes", "year", false);
    expect(keys(visibleColumns("itunes", p)).slice(0, 2)).toEqual(["name", "artist"]);
    expect(keys(visibleColumns("itunes", setColumnShown(p, "itunes", "year", true))).slice(0, 2)).toEqual(["year", "name"]);
  });
});

describe("saving and loading", () => {
  it("what was saved comes back", () => {
    const m = memory();
    const p = setColumnShown(moveColumn(setColumnShown(defaultPrefs(), "feel", "year", true), "itunes", "year", "name"), "itunes", "plays", false);
    savePrefs(p, m);
    const back = loadPrefs(m);
    expect(back.order).toEqual(p.order);
    for (const g of ["itunes", "archive", "feel", "cube"] as const) expect([...back.hidden[g]].sort()).toEqual([...p.hidden[g]].sort());
  });
  it("is the format of the current page: hidden lists, with the columns it has seen; and the orders", () => {
    const m = memory();
    savePrefs(defaultPrefs(), m);
    const h = JSON.parse(m.data[HIDDEN_KEY]!);
    expect(h.itunes).toEqual(["path"]);
    expect(h.seen.itunes).toEqual(columnsOf("itunes").map((c) => c.key));
    expect(JSON.parse(m.data[ORDER_KEY]!).archive).toEqual(columnsOf("archive").map((c) => c.key));
  });
  it("a column that is hidden by default but was shown by the user stays shown", () => {
    const m = memory();
    savePrefs(setColumnShown(defaultPrefs(), "itunes", "path", true), m);
    expect(loadPrefs(m).hidden.itunes.has("path")).toBe(false);
  });
  it("a column the page had not seen yet starts hidden if it is hidden by default", () => {
    const m = memory();
    m.data[HIDDEN_KEY] = JSON.stringify({ itunes: [], seen: { itunes: columnsOf("itunes").map((c) => c.key).filter((k) => k !== "path") } });
    expect(loadPrefs(m).hidden.itunes.has("path")).toBe(true);
  });
  it("an order from an older page gets the new columns in their places", () => {
    const m = memory();
    m.data[ORDER_KEY] = JSON.stringify({ itunes: columnsOf("itunes").map((c) => c.key).filter((k) => k !== "track").reverse() });
    const order = loadPrefs(m).order.itunes;
    expect(order).toHaveLength(columnsOf("itunes").length);
    expect(new Set(order).size).toBe(order.length);
    expect(order).toContain("track");
  });
  it("nothing stored, damaged text or blocked storage gives the usual columns", () => {
    expect(loadPrefs(memory())).toEqual(defaultPrefs());
    const bad = memory();
    bad.data[HIDDEN_KEY] = "{oops";
    bad.data[ORDER_KEY] = "[1,2";
    expect(loadPrefs(bad)).toEqual(defaultPrefs());
    const odd = memory();
    odd.data[HIDDEN_KEY] = "[1]";
    odd.data[ORDER_KEY] = '"x"';
    expect(loadPrefs(odd)).toEqual(defaultPrefs());
    const blocked: PrefsStorage = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
    expect(loadPrefs(blocked)).toEqual(defaultPrefs());
    expect(() => savePrefs(defaultPrefs(), blocked)).not.toThrow();
    expect(loadPrefs(null)).toEqual(defaultPrefs());
  });
});

describe("the sort goes when its column is hidden", () => {
  it("dropSort clears it, and does nothing when there is none", () => {
    const sorted = reduce(initialUiState(), { type: "sort", key: "year" });
    expect(reduce(sorted, { type: "dropSort" }).sort.key).toBeNull();
    const plain = initialUiState();
    expect(reduce(plain, { type: "dropSort" })).toBe(plain);
  });
});
