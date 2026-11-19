import { describe, expect, it, vi } from "vitest";
import { isPresetList, remove, removeWithConfirm, rename, renameWithPrompt, replaceState, saveAs, type Preset, type PresetUi } from "./presets";

const p = (name: string, mark = name): Preset => ({ name, state: { tab: "itunes", mark } });
const names = (l: readonly Preset[]) => l.map((x) => x.name);
const ui = (typed: string | null, ok = true): PresetUi => ({ prompt: vi.fn(() => typed), confirm: vi.fn(() => ok) });

describe("isPresetList", () => {
  it("accepts a list of named views", () => {
    expect(isPresetList([])).toBe(true);
    expect(isPresetList([p("A"), p("B")])).toBe(true);
  });
  it("rejects anything else", () => {
    for (const bad of [null, undefined, {}, "x", [{ name: "A" }], [{ state: {} }], [{ name: 1, state: {} }], [{ name: "A", state: null }], [null]]) expect(isPresetList(bad)).toBe(false);
  });
});

describe("saveAs", () => {
  it("adds a preset, keeping the list in name order", () => {
    const r = saveAs([p("Zebra"), p("Apple")], "Mango", { tab: "feel" })!;
    expect(r.updated).toBe(false);
    expect(names(r.list)).toEqual(["Apple", "Mango", "Zebra"]);
    expect(r.list[1]!.state).toEqual({ tab: "feel" });
  });
  it("the same name again updates it, ignoring capitals, and keeps its own spelling", () => {
    const r = saveAs([p("Calm Evenings", "old")], "calm evenings", { tab: "cube", mark: "new" })!;
    expect(r.updated).toBe(true);
    expect(names(r.list)).toEqual(["Calm Evenings"]);
    expect(r.list[0]!.state).toEqual({ tab: "cube", mark: "new" });
  });
  it("trims the name, and an empty one saves nothing", () => {
    expect(names(saveAs([], "  Road  ", { tab: "itunes" })!.list)).toEqual(["Road"]);
    expect(saveAs([], "   ", { tab: "itunes" })).toBeNull();
  });
  it("does not change the list it was given", () => {
    const before = [p("B"), p("A")];
    saveAs(before, "C", { tab: "itunes" });
    expect(names(before)).toEqual(["B", "A"]);
  });
});

describe("replaceState, rename, remove", () => {
  const list = [p("Apple", "a"), p("Banana", "b"), p("Cherry", "c")];
  it("replaceState puts the current view into one preset and leaves the rest", () => {
    const next = replaceState(list, 1, { tab: "cube", mark: "new" });
    expect(next[1]).toEqual({ name: "Banana", state: { tab: "cube", mark: "new" } });
    expect(next[0]).toBe(list[0]);
  });
  it("rename changes the name and keeps the list in order", () => {
    const next = rename(list, 0, "  Zucchini ");
    expect(names(next)).toEqual(["Banana", "Cherry", "Zucchini"]);
    expect(next[2]!.state).toEqual(list[0]!.state);
  });
  it("an empty new name, or a preset that is not there, changes nothing", () => {
    expect(names(rename(list, 0, "  "))).toEqual(names(list));
    expect(names(rename(list, 9, "X"))).toEqual(names(list));
  });
  it("remove takes one out", () => {
    expect(names(remove(list, 1))).toEqual(["Apple", "Cherry"]);
    expect(names(remove(list, 9))).toEqual(names(list));
  });
});

describe("with the browser's questions", () => {
  const list = [p("Apple"), p("Banana")];
  it("renaming asks for the new name, starting from the old one", () => {
    const u = ui("Blueberry");
    expect(names(renameWithPrompt(list, 1, u)!)).toEqual(["Apple", "Blueberry"]);
    expect(u.prompt).toHaveBeenCalledWith("New name for this preset", "Banana");
  });
  it("cancelling or typing nothing leaves it", () => {
    expect(renameWithPrompt(list, 0, ui(null))).toBeNull();
    expect(renameWithPrompt(list, 0, ui("   "))).toBeNull();
    expect(renameWithPrompt(list, 9, ui("X"))).toBeNull();
  });
  it("deleting asks first, naming the preset", () => {
    const u = ui(null, true);
    expect(names(removeWithConfirm(list, 0, u)!)).toEqual(["Banana"]);
    expect(u.confirm).toHaveBeenCalledWith('Delete the preset "Apple"?');
  });
  it("declining keeps it", () => {
    expect(removeWithConfirm(list, 0, ui(null, false))).toBeNull();
  });
});
