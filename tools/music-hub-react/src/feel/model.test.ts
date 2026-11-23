import { describe, expect, it } from "vitest";
import { FEEL_SCALES, fullFeelRanges } from "../data/feel";
import { fixtureLibrary } from "../data/fixture";
import { buildDataset } from "../data/load";
import { buildCube, fullBox } from "./cube";
import { cubeModel, devColor, feelModel, jit, mixColor, plain, selectionStats, signed, type Palette } from "./model";

const ds = buildDataset(fixtureLibrary());
const cube = buildCube(ds.songs, ds.axes)!;
const idx = (key: string) => FEEL_SCALES.findIndex((s) => s.key === key);
const P: Palette = { mut: [100, 100, 100], cool: [0, 0, 255], warm: [255, 128, 0], acc: "#00f", line: "#ccc", mutS: "#888", fg: "#111", bg: "#fff" };
const stat = { mean: 5, sd: 2 };

describe("devColor", () => {
  it("is grey at the mean, warm above and cool below", () => {
    expect(devColor(5, stat, P)).toBe("rgb(100,100,100)");
    expect(devColor(10, stat, P)).toBe("rgb(255,128,0)"); // +2.5 sd: full warm
    expect(devColor(0, stat, P)).toBe("rgb(0,0,255)"); // -2.5 sd: full cool
  });
  it("stops at ±2.5 standard deviations", () => {
    expect(devColor(100, stat, P)).toBe(devColor(10, stat, P));
    expect(devColor(-100, stat, P)).toBe(devColor(0, stat, P));
  });
  it("is halfway at ±1.25 sd", () => {
    expect(devColor(7.5, stat, P)).toBe(mixColor(P.mut, P.warm, 0.5));
  });
  it("has no color for a missing score, and copes with no spread", () => {
    expect(devColor(null, stat, P)).toBeNull();
    expect(devColor(undefined, stat, P)).toBeNull();
    expect(devColor(7, { mean: 5, sd: 0 }, P)).toBe("rgb(100,100,100)");
  });
});

describe("jit", () => {
  it("is fixed per song and axis, within -0.5..0.5, and different between axes", () => {
    expect(jit(3, 0)).toBe(jit(3, 0));
    for (let ix = 0; ix < 200; ix++) for (let a = 0; a < 3; a++) expect(Math.abs(jit(ix, a))).toBeLessThanOrEqual(0.5);
    expect(jit(3, 0)).not.toBe(jit(3, 1));
    expect(jit(3, 0)).not.toBe(jit(4, 0));
  });
});

describe("cubeModel", () => {
  const model = cubeModel(cube, fullBox(cube), ds.feelStats);
  it("three axes with the names and the short ends of the axes", () => {
    expect(model).toMatchObject({ kind: "cube", n: 3, colorName: "maturity" });
    expect(model.ax.map((a) => [a.name, a.ls, a.hs])).toEqual([["Calm", "Bright", "Calm"], ["Ease", "Demanding", "Easy"], ["Awe", "Down-to-earth", "Awe"]]);
    expect(model.ax[0]!.lowT).toBe("Bright · strong");
  });
  it("only rated songs can be drawn, at their coordinates plus the nudge", () => {
    expect(ds.songs.filter(model.has).map((s) => s.ix)).toEqual([0, 1, 2, 3]);
    expect(model.pos(ds.songs[0]!, 0)).toBeCloseTo(cube.coords[0]![0]! + cube.jitter[0]![0]!, 10);
  });
  it("colors the dots by maturity, hollow when there is none", () => {
    expect(model.color(ds.songs[0]!, P)).not.toBeNull();
    expect(model.color(ds.songs[2]!, P)).toBeNull();
  });
  it("the statistics block has the three axes and maturity", () => {
    expect(model.stats().map((s) => s.name)).toEqual(["Calm", "Ease", "Awe", "Maturity"]);
  });
  it("describes a dot for the hover text", () => {
    expect(model.dotText(ds.songs[0]!)).toBe("The Webs — Spider Man Theme   (maturity 7)");
    expect(model.dotText(ds.songs[2]!)).toContain("maturity n/a");
  });
});

describe("feelModel", () => {
  const ranges = fullFeelRanges();
  ranges[idx("power")] = [5, 10];
  ranges[idx("joyful")] = [0, 4];

  it("no narrowed slider: no axes, and the statistics list every scale", () => {
    const m = feelModel([], fullFeelRanges(), ds.feelStats);
    expect(m.n).toBe(0);
    expect(m.colorName).toBeNull();
    expect(m.stats()).toHaveLength(10);
  });
  it("the first three narrowed scales are the axes; a fourth colors the dots", () => {
    const three = feelModel([idx("power"), idx("joyful"), idx("wonder")], ranges, ds.feelStats);
    expect(three).toMatchObject({ n: 3, colorName: null });
    expect(three.ax.map((a) => a.name)).toEqual(["Power", "Joyful activation", "Wonder"]);
    const four = feelModel([idx("power"), idx("joyful"), idx("wonder"), idx("sadness")], ranges, ds.feelStats);
    expect(four).toMatchObject({ n: 3, colorName: "Sadness" });
    expect(four.stats().map((s) => s.name)).toEqual(["Power", "Joyful activation", "Wonder", "Sadness"]);
  });
  it("narrowed scales beyond four still filter and are named as not plotted", () => {
    const m = feelModel([0, 1, 2, 3, 4, 5], fullFeelRanges(), ds.feelStats);
    expect(m.extra).toEqual(["Peacefulness", "Power"]);
  });
  it("the box wraps the first and last whole number of each range", () => {
    const m = feelModel([idx("power"), idx("joyful")], ranges, ds.feelStats);
    expect(m.box).toEqual([[4.5, 10.5], [-0.5, 4.5]]);
    expect([m.lo, m.hi]).toEqual([[-0.6, -0.6], [10.6, 10.6]]);
  });
  it("a song can be drawn only if it has every plotted score", () => {
    const m = feelModel([idx("power"), idx("maturity")], fullFeelRanges(), ds.feelStats);
    expect(ds.songs.filter(m.has).map((s) => s.ix)).toEqual([0, 1, 3]); // song 2 (instrumental) has no maturity; unrated songs have no feel
  });
  it("positions are the score plus a small nudge", () => {
    const m = feelModel([idx("power")], ranges, ds.feelStats);
    expect(m.pos(ds.songs[3]!, 0)).toBeCloseTo(9 + jit(3, 0) * 0.5, 10);
  });
  it("one dot color until a fourth scale is narrowed", () => {
    const m = feelModel([idx("power")], ranges, ds.feelStats);
    expect(m.color(ds.songs[0]!, P)).toBe("rgb(100,100,100)");
  });
  it("describes a dot with the plotted scores", () => {
    const m = feelModel([idx("power"), idx("joyful")], ranges, ds.feelStats);
    expect(m.dotText(ds.songs[3]!)).toBe("AC/DC — Highway to Hell   (Power 9 · Joyful activation 6)");
  });
});

describe("selectionStats", () => {
  it("the mean of the listed songs, against the mean of all rated songs", () => {
    const power = ds.feelStats.power!;
    const [line] = selectionStats([ds.songs[1]!, ds.songs[3]!], [{ name: "Power", get: (s) => s.feel?.[5] ?? null, m: power.mean, sd: power.sd, dp: 1 }]);
    expect(line!.n).toBe(2);
    expect(line!.mean).toBe(7); // 5 and 9
    expect(line!.d).toBeCloseTo(7 - power.mean, 10);
    expect(line!.z).toBeCloseTo((7 - power.mean) / power.sd, 10);
  });
  it("songs without a score are left out of the mean; none at all gives no mean", () => {
    const def = { name: "Maturity", get: (s: (typeof ds.songs)[number]) => s.feel?.[9] ?? null, m: 5, sd: 2, dp: 1 };
    expect(selectionStats([ds.songs[0]!, ds.songs[2]!], [def])[0]!.n).toBe(1);
    const none = selectionStats([ds.songs[2]!, ds.songs[4]!], [def])[0]!;
    expect(none).toMatchObject({ n: 0, mean: null, d: null, z: 0 });
  });
});

describe("number formats", () => {
  it("signed always shows a sign, and never a minus on a zero", () => {
    expect(signed(0.42, 2)).toBe("+0.42");
    expect(signed(-0.42, 2)).toBe("−0.42");
    expect(signed(-0.001, 2)).toBe("+0.00");
    expect(signed(0, 1)).toBe("+0.0");
  });
  it("plain avoids -0.00", () => {
    expect(plain(3.14159, 2)).toBe("3.14");
    expect(plain(-0.001, 2)).toBe("0.00");
    expect(plain(-1.5, 1)).toBe("-1.5");
  });
});
