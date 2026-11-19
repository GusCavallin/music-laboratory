import { describe, expect, it } from "vitest";
import { feelColumnIndex, fullFeelRanges, passesFeel, FEEL_SCALES } from "./feel";
import { fixtureLibrary } from "./fixture";
import { buildDataset } from "./load";

const ds = buildDataset(fixtureLibrary());
const [a, b, c, d, unrated] = ds.songs; // a: peaceful 6 / maturity 7, c: instrumental (no maturity), d: loud and tense
const idx = (key: string) => FEEL_SCALES.findIndex((s) => s.key === key);

describe("feelColumnIndex", () => {
  it("maps score columns to positions in a song's feel array", () => {
    expect(feelColumnIndex("f_wonder")).toBe(0);
    expect(feelColumnIndex("f_peacefulness")).toBe(4);
    expect(feelColumnIndex("f_maturity")).toBe(9);
    expect(feelColumnIndex("f_conf")).toBe(10);
  });
  it("is null for other columns", () => {
    expect(feelColumnIndex("name")).toBeNull();
    expect(feelColumnIndex("f_bogus")).toBeNull();
  });
});

describe("passesFeel", () => {
  it("a full range lets every rated song through, and never an unrated one", () => {
    const r = fullFeelRanges();
    expect([a, b, c, d].every((s) => passesFeel(s!, r, 0))).toBe(true);
    expect(passesFeel(unrated!, r, 0)).toBe(false);
  });
  it("keeps songs inside the range, edges included", () => {
    const r = fullFeelRanges();
    r[idx("peacefulness")] = [6, 10];
    expect(passesFeel(a!, r, 0)).toBe(true); // exactly 6
    expect(passesFeel(c!, r, 0)).toBe(true); // 8
    expect(passesFeel(b!, r, 0)).toBe(false); // 3
    expect(passesFeel(d!, r, 0)).toBe(false); // 0
  });
  it("a missing score passes only a full range", () => {
    const r = fullFeelRanges();
    expect(passesFeel(c!, r, 0)).toBe(true); // maturity is empty, range is full
    r[idx("maturity")] = [0, 9];
    expect(passesFeel(c!, r, 0)).toBe(false);
  });
  it("filters by confidence (1 low, 2 medium, 3 high; 0 = all)", () => {
    const r = fullFeelRanges();
    expect(passesFeel(c!, r, 2)).toBe(true);
    expect(passesFeel(a!, r, 2)).toBe(false);
    expect(passesFeel(a!, r, 3)).toBe(true);
  });
});
