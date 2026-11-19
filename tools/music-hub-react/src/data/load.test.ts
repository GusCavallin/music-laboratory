import { describe, expect, it } from "vitest";
import { fixtureLibrary } from "./fixture";
import { buildDataset, parseLibraryScript } from "./load";

describe("parseLibraryScript", () => {
  it("reads the window.LIB = {...}; form that build_data.py writes", () => {
    const lib = fixtureLibrary();
    const text = "window.LIB = " + JSON.stringify(lib) + ";\n";
    expect(parseLibraryScript(text)).toEqual(lib);
  });
});

describe("buildDataset", () => {
  const ds = buildDataset(fixtureLibrary());

  it("turns the rows into objects, keeping their positions", () => {
    expect(ds.songs).toHaveLength(8);
    expect(ds.songs.map((s) => s.ix)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    const s = ds.songs[0]!;
    expect(s).toMatchObject({ name: "Spider Man Theme", artist: "The Webs", year: 1994, stars: 5, loved: true, protected: false });
    expect(s.path).toBe("C:\\music\\Spider Man Theme.mp3");
  });
  it("keeps the track and disc numbers", () => {
    expect(ds.songs[5]).toMatchObject({ track: 1, tracks: 2, disc: 2, discs: 2 });
  });
  it("keeps unrated songs without feel scores, and a missing maturity as null", () => {
    expect(ds.songs[4]!.feel).toBeNull();
    expect(ds.songs[2]!.feel![9]).toBeNull();
  });
  it("prepares the search text and the folded artist and album", () => {
    const aha = ds.songs[1]!;
    expect(aha.h).toContain("a ha");
    expect(aha.j).toContain("aha");
    expect(ds.songs[2]!.artistFold).toBe("antonin dvorak");
  });
  it("builds the archive and the playlists (with the smart flag)", () => {
    expect(ds.archive).toHaveLength(3);
    expect(ds.archive[0]).toMatchObject({ name: "Lullaby", volume: "Mp3_1S", in_itunes: true });
    expect(ds.playlists.map((p) => [p.name, p.smart])).toEqual([["Road Trip", false], ["Smart Mix", true]]);
  });
  it("computes the mean and the sample standard deviation of each scale over the rated songs", () => {
    const w = ds.feelStats.wonder!; // 3, 2, 7, 1
    expect(w.n).toBe(4);
    expect(w.mean).toBeCloseTo(3.25, 5);
    expect(w.sd).toBeCloseTo(2.63, 2);
    const m = ds.feelStats.maturity!; // 7, 4, (none), 3
    expect(m.n).toBe(3);
    expect(m.mean).toBeCloseTo(4.667, 3);
    expect(m.sd).toBeCloseTo(2.082, 3);
  });
  it("carries the build date and version", () => {
    expect(ds.built).toBe("2026-11-19 10:00");
    expect(ds.version).toBe("0.2.0");
  });
});
