import { describe, expect, it } from "vitest";
import { fixtureLibrary } from "../data/fixture";
import { buildDataset } from "../data/load";
import { buildCube, cubeJitter, fullBox, maturityNarrowed, passesCube } from "./cube";

const ds = buildDataset(fixtureLibrary());
const cube = buildCube(ds.songs, ds.axes)!;

describe("buildCube", () => {
  it("gives every rated song three coordinates, and an unrated song none", () => {
    expect(cube.coords[0]).toHaveLength(3);
    for (const ix of [0, 1, 2, 3]) expect(cube.coords[ix]).not.toBeNull();
    for (const ix of [4, 5, 6, 7]) {
      expect(cube.coords[ix]).toBeNull();
      expect(cube.jitter[ix]).toBeNull();
    }
  });
  it("coordinates are the z-scores weighted by the loadings and scaled to unit variance", () => {
    // song 0: scores 3 3 4 5 6 1 2 2 3 -> z = 0 0 .5 .5 1 -1.5 -1 -.5 0 (means 3 3 3 4 4 4 4 3 3, spread 2)
    const [calm, ease, awe] = cube.coords[0]!;
    expect(calm).toBeCloseTo((0.25 + 0.1 + 0.5 + 0.6 + 0.2) / 2, 10); // .5*.5 + .2*.5 + .5*1 + -.4*-1.5 + -.2*-1, over sqrt(4)
    expect(ease).toBeCloseTo(0.5 * -1 - 0.5 * -0.5 - 0.5 * 0, 10);
    expect(awe).toBeCloseTo(0.3 * -1.5, 10);
  });
  it("the bounds are rounded out to half a unit and hold every song", () => {
    for (let i = 0; i < 3; i++) {
      expect(cube.lo[i]! * 2).toBe(Math.round(cube.lo[i]! * 2));
      expect(cube.hi[i]! * 2).toBe(Math.round(cube.hi[i]! * 2));
      for (const ix of [0, 1, 2, 3]) {
        expect(cube.coords[ix]![i]!).toBeGreaterThan(cube.lo[i]!);
        expect(cube.coords[ix]![i]!).toBeLessThan(cube.hi[i]!);
      }
    }
  });
  it("mean and spread are over the rated songs", () => {
    const first = [0, 1, 2, 3].map((ix) => cube.coords[ix]![0]!);
    const mean = first.reduce((a, b) => a + b, 0) / first.length;
    expect(cube.mean[0]).toBeCloseTo(mean, 10);
    expect(cube.sd[0]).toBeCloseTo(Math.sqrt(first.reduce((a, b) => a + (b - mean) ** 2, 0) / first.length), 10);
  });
  it("is null without axes or without rated songs", () => {
    expect(buildCube(ds.songs, null)).toBeNull();
    expect(buildCube(ds.songs.filter((s) => !s.feel), ds.axes)).toBeNull();
  });
});

describe("cubeJitter", () => {
  it("is the same for the same song, small, and different between songs and axes", () => {
    expect(cubeJitter(5)).toEqual(cubeJitter(5));
    for (const ix of [0, 1, 2, 3, 100, 7000]) for (const v of cubeJitter(ix)) expect(Math.abs(v)).toBeLessThanOrEqual(0.15);
    expect(cubeJitter(5)).not.toEqual(cubeJitter(6));
    const [a, b, c] = cubeJitter(5);
    expect(new Set([a, b, c]).size).toBe(3);
  });
});

describe("passesCube", () => {
  const box = fullBox(cube);
  it("the full box holds every rated song and no unrated one", () => {
    expect(ds.songs.filter((s) => passesCube(cube, s, box)).map((s) => s.ix)).toEqual([0, 1, 2, 3]);
  });
  it("narrowing an axis keeps the songs inside the range", () => {
    const calms = [0, 1, 2, 3].map((ix) => cube.coords[ix]![0]!);
    const mid = [...calms].sort((a, b) => a - b)[1]!;
    const narrowed = { ...box, ranges: [[mid, cube.hi[0]!], box.ranges[1]!, box.ranges[2]!] as [number, number][] };
    const inside = ds.songs.filter((s) => passesCube(cube, s, narrowed)).map((s) => s.ix);
    expect(inside.length).toBe(calms.filter((c) => c >= mid).length);
    for (const ix of inside) expect(cube.coords[ix]![0]!).toBeGreaterThanOrEqual(mid);
  });
  it("narrowing maturity leaves out songs that have none (instrumentals)", () => {
    expect(maturityNarrowed([0, 10])).toBe(false);
    expect(maturityNarrowed([0, 9])).toBe(true);
    const out = ds.songs.filter((s) => passesCube(cube, s, { ...box, maturity: [5, 10] })).map((s) => s.ix);
    expect(out).toEqual([0]); // song 0 has maturity 7; song 1 has 4; song 2 has none; song 3 has 3
  });
});
