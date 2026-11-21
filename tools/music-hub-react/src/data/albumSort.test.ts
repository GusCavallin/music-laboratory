import { describe, expect, it } from "vitest";
import { defaultSongFilter, filterSongs } from "./filter";
import { fixtureLibrary } from "./fixture";
import { buildDataset } from "./load";

// Invented songs, in a scrambled library order. Only name, artist, album, track, disc matter here; the rest are placeholders (columns as in fixture.ts).
const row = (name: string, artist: string, album: string, track: number, disc: number): unknown[] => [
  name, artist, album, "", "", "", 0, 0, 0, 0, "", 200, "", 0, 0, track, 0, disc, 0, null, `C:\\music\\${name}.mp3`,
];

const library = [
  // 0-4: a two-disc compilation with a different artist on every song
  row("c2t1", "Pianist D", "Piano Classics", 1, 2),
  row("c1t2", "Pianist B", "Piano Classics", 2, 1),
  row("c1t1", "Pianist A", "Piano Classics", 1, 1),
  row("c2t2", "Pianist C", "Piano Classics", 2, 2),
  row("c1t3", "Pianist A", "Piano Classics", 3, 1),
  // 5-10: three different albums that happen to share the title "Greatest Hits"
  row("q2", "Queen", "Greatest Hits", 2, 1),
  row("a1", "ABBA", "Greatest Hits", 1, 1),
  row("q1", "Queen", "Greatest Hits", 1, 1),
  row("a2", "ABBA", "Greatest Hits", 2, 1),
  row("z1", "Zebra", "Greatest Hits", 1, 1),
  row("z2", "Zebra", "Greatest Hits", 2, 1),
  // 11-12: an ordinary album
  row("s2", "Solo", "Solo Album", 2, 1),
  row("s1", "Solo", "Solo Album", 1, 1),
  // 13-14: a single-disc compilation with no disc tags at all
  row("n2", "Other B", "Loose Mix", 2, 0),
  row("n1", "Other A", "Loose Mix", 1, 0),
];

const ds = buildDataset({ ...fixtureLibrary(), itunes: library as never });
const name = (ix: number) => library[ix]![0] as string;
const albumSort = (desc = false) => filterSongs(ds, defaultSongFilter(), { key: "album", desc }).map((s) => name(s.ix));

describe("album sort", () => {
  it("keeps a compilation with a different artist on every song in disc and track order", () => {
    const order = albumSort().filter((n) => n.startsWith("c"));
    expect(order).toEqual(["c1t1", "c1t2", "c1t3", "c2t1", "c2t2"]);
  });
  it("tells apart albums that share a title, by artist, each in track order", () => {
    const order = albumSort().filter((n) => /^[aqz]\d$/.test(n));
    expect(order).toEqual(["a1", "a2", "q1", "q2", "z1", "z2"]);
  });
  it("keeps every album as one block, in alphabetical order of the title", () => {
    expect(albumSort()).toEqual([
      "a1", "a2", "q1", "q2", "z1", "z2", // Greatest Hits
      "n1", "n2", // Loose Mix
      "c1t1", "c1t2", "c1t3", "c2t1", "c2t2", // Piano Classics
      "s1", "s2", // Solo Album
    ]);
  });
  it("descending reverses the whole order", () => {
    expect(albumSort(true)).toEqual([...albumSort()].reverse());
  });
  it("a compilation without disc tags is in track order", () => {
    expect(albumSort().filter((n) => n.startsWith("n"))).toEqual(["n1", "n2"]);
  });
});

describe("track sort", () => {
  const byTrack = (desc = false) => filterSongs(ds, defaultSongFilter(), { key: "track", desc }).map((s) => name(s.ix));

  it("goes disc by disc: every track of disc 1 by number, then disc 2", () => {
    const order = byTrack();
    expect(order.slice(-2)).toEqual(["c2t1", "c2t2"]); // disc 2 comes after everything on disc 1, not between the track numbers
    expect(order.indexOf("c1t3")).toBeLessThan(order.indexOf("c2t1"));
  });
  it("within a disc it is by track number, and equal rows keep their library order", () => {
    expect(byTrack()).toEqual(["c1t1", "a1", "q1", "z1", "s1", "n1", "c1t2", "q2", "a2", "z2", "s2", "n2", "c1t3", "c2t1", "c2t2"]);
  });
  it("a song without a disc tag counts as disc 1 (the Track column shows no disc for it)", () => {
    const order = byTrack();
    expect(order.indexOf("n1")).toBeLessThan(order.indexOf("c1t2")); // n1 is track 1 with no disc tag: with the other track 1s of disc 1
    expect(order.indexOf("n2")).toBeGreaterThan(order.indexOf("c1t2"));
  });
  it("descending goes from the last disc and the last track", () => {
    expect(byTrack(true).slice(0, 3)).toEqual(["c2t2", "c2t1", "c1t3"]);
  });
});

describe("what tells albums apart", () => {
  const group = (n: string) => ds.songs[library.findIndex((r) => r[0] === n)]!.albumGroup;
  it("is the artist only where the title repeats a disc and track number", () => {
    expect(group("q1")).toBe("Queen");
    expect(group("a2")).toBe("ABBA");
  });
  it("is empty for a compilation, an ordinary album and a song without an album", () => {
    expect(group("c1t1")).toBe("");
    expect(group("c2t2")).toBe("");
    expect(group("s1")).toBe("");
    expect(group("n1")).toBe("");
  });
  it("does not depend on the filter that is active (it is worked out from the whole library)", () => {
    const only = filterSongs(ds, { ...defaultSongFilter(), query: "queen" }, { key: "album", desc: false });
    expect(only.map((s) => name(s.ix))).toEqual(["q1", "q2"]);
    expect(only.every((s) => s.albumGroup === "Queen")).toBe(true);
  });
});
