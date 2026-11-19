import { describe, expect, it } from "vitest";
import { fixtureLibrary } from "../data/fixture";
import { buildDataset } from "../data/load";
import type { Song } from "../data/types";
import { pickDot, splitDots, type Dot } from "./draw";
import type { GraphModel } from "./model";

const ds = buildDataset(fixtureLibrary());
const [a, b, c] = ds.songs as [Song, Song, Song];

describe("pickDot", () => {
  const dots: Dot[] = [{ x: 100, y: 100, r: 3, song: a }, { x: 104, y: 100, r: 3, song: b }, { x: 300, y: 200, r: 3, song: c }];
  it("finds the dot under the pointer, within a few pixels of its edge", () => {
    expect(pickDot(dots, 300, 200)).toBe(c);
    expect(pickDot(dots, 306, 200)).toBe(c); // radius 3 + 4 px
    expect(pickDot(dots, 308, 200)).toBeNull();
  });
  it("the nearest of two overlapping dots wins", () => {
    expect(pickDot(dots, 101, 100)).toBe(a);
    expect(pickDot(dots, 103, 100)).toBe(b);
  });
  it("nothing when nothing is near, or there are no dots", () => {
    expect(pickDot(dots, 0, 0)).toBeNull();
    expect(pickDot([], 5, 5)).toBeNull();
  });
  it("on an exact tie the dot drawn later (on top) wins", () => {
    const tie: Dot[] = [{ x: 10, y: 10, r: 3, song: a }, { x: 10, y: 10, r: 3, song: b }];
    expect(pickDot(tie, 10, 10)).toBe(b);
  });
});

describe("splitDots", () => {
  const model = { has: (s: Song) => !!s.feel } as GraphModel;
  it("songs the model can draw are bright if they are in the list and dim if something filters them out", () => {
    const { bright, dim } = splitDots(ds.songs, model, new Set([0, 2]));
    expect(bright.map((s) => s.ix)).toEqual([0, 2]);
    expect(dim.map((s) => s.ix)).toEqual([1, 3]);
  });
  it("songs the model cannot draw (no scores) are in neither", () => {
    const { bright, dim } = splitDots(ds.songs, model, new Set([4, 5]));
    expect(bright).toEqual([]);
    expect(dim).toHaveLength(4);
  });
});
