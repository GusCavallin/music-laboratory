import { describe, expect, it } from "vitest";
import {
  defaultArchiveFilter, defaultSongFilter, filterArchive, filterSongs, fullFeelRanges, noFacet, noSort, sortRows,
  type SongFilter,
} from "./filter";
import { FEEL_SCALES } from "./feel";
import { fixtureLibrary } from "./fixture";
import { buildCube, fullBox } from "../feel/cube";
import { buildDataset } from "./load";

const ds = buildDataset(fixtureLibrary());
const ixs = (rows: { ix: number }[]) => rows.map((r) => r.ix);
const songs = (patch: Partial<SongFilter> = {}, sort = noSort()) => ixs(filterSongs(ds, { ...defaultSongFilter(), ...patch }, sort));
const scale = (key: string) => FEEL_SCALES.findIndex((s) => s.key === key);

describe("filterSongs", () => {
  it("returns every song, in library order, with no filters", () => {
    expect(songs()).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });
  it("searches the name, artist, album, composer and genres", () => {
    expect(songs({ query: "rock" })).toEqual([0, 3]); // genres
    expect(songs({ query: "dvorak" })).toEqual([2]); // accents ignored
    expect(songs({ query: "aha" })).toEqual([1]);
    expect(songs({ query: "highway hell" })).toEqual([3]);
    expect(songs({ query: "nothing like this" })).toEqual([]);
  });
  it("filters by the star range", () => {
    expect(songs({ stars: [4, 5] })).toEqual([0, 1, 2, 5, 6, 7]);
    expect(songs({ stars: [0, 0] })).toEqual([4]);
    expect(songs({ stars: [3, 3] })).toEqual([3]);
  });
  it("filters to hearted songs", () => {
    expect(songs({ lovedOnly: true })).toEqual([0, 2]);
  });
  it("filters by decade and country", () => {
    expect(songs({ decade: "1990s" })).toEqual([0]);
    expect(songs({ decade: "1980s" })).toEqual([1]);
    expect(songs({ decade: "0s" })).toEqual([4, 5, 6, 7]); // unknown year
    expect(songs({ country: "AU" })).toEqual([3]);
  });
  it("combines filters (all must hold)", () => {
    expect(songs({ query: "rock", stars: [4, 5] })).toEqual([0]);
    expect(songs({ lovedOnly: true, decade: "1890s" })).toEqual([2]);
  });

  describe("playlists", () => {
    it("shows only the playlist's songs, in playlist order, each once (first position wins)", () => {
      expect(songs({ playlist: "Road Trip" })).toEqual([3, 0, 1]);
    });
    it("a chosen sort replaces the playlist order", () => {
      expect(songs({ playlist: "Road Trip" }, { key: "stars", desc: true })).toEqual([0, 1, 3]);
    });
    it("text that is not a playlist name filters nothing", () => {
      expect(songs({ playlist: "Road" })).toHaveLength(8);
      expect(songs({ playlist: "Nope" })).toHaveLength(8);
    });
    it("works together with other filters", () => {
      expect(songs({ playlist: "Road Trip", query: "rock" })).toEqual([3, 0]);
    });
  });

  describe("artist and album chips", () => {
    it("match the exact name, ignoring capitals and accents", () => {
      expect(songs({ facet: { ...noFacet(), artist: "A-HA" } })).toEqual([1]);
      expect(songs({ facet: { ...noFacet(), artist: "antonin dvorak" } })).toEqual([2]);
      expect(songs({ facet: { ...noFacet(), album: "highway to hell" } })).toEqual([3]);
    });
    it("do not match part of a name", () => {
      expect(songs({ facet: { ...noFacet(), artist: "a" } })).toEqual([]);
    });
  });

  describe("Raw Feel", () => {
    const feel = (patch: Record<string, [number, number]>, confidence = 0) => {
      const ranges = fullFeelRanges();
      for (const [k, v] of Object.entries(patch)) ranges[scale(k)] = v;
      return { ranges, confidence };
    };
    it("with full ranges, keeps only the rated songs", () => {
      expect(songs({ feel: feel({}) })).toEqual([0, 1, 2, 3]);
    });
    it("narrows by scale", () => {
      expect(songs({ feel: feel({ peacefulness: [6, 10] }) })).toEqual([0, 2]);
      expect(songs({ feel: feel({ power: [5, 10] }) })).toEqual([1, 3]);
    });
    it("narrowing maturity leaves out songs that have none", () => {
      expect(songs({ feel: feel({ maturity: [5, 10] }) })).toEqual([0]);
    });
    it("filters by confidence", () => {
      expect(songs({ feel: feel({}, 2) })).toEqual([2]);
    });
    it("combines with the other filters", () => {
      expect(songs({ feel: feel({ peacefulness: [6, 10] }), lovedOnly: true, stars: [5, 5] })).toEqual([0, 2]);
      expect(songs({ feel: feel({ peacefulness: [6, 10] }), query: "largo" })).toEqual([2]);
    });
  });
});

describe("sorting", () => {
  it("an album sort keeps each album together, in disc and track order", () => {
    // Blank, Double (disc 1 track 1, disc 1 track 2, disc 2 track 1), Heroes, Highway to Hell, Hunting..., New World...
    expect(songs({}, { key: "album", desc: false })).toEqual([4, 7, 6, 5, 0, 3, 1, 2]);
    expect(songs({}, { key: "album", desc: true })).toEqual([2, 1, 3, 0, 5, 6, 7, 4]);
  });
  it("sorts text and numbers", () => {
    expect(songs({}, { key: "name", desc: false })).toEqual([7, 6, 5, 3, 2, 0, 1, 4]);
    expect(songs({}, { key: "stars", desc: true }).slice(0, 3)).toEqual([0, 2, 1]); // 5, 5, then the 4s in library order
  });
  it("sorts by a Feel score, with songs that have no score last when descending", () => {
    expect(songs({}, { key: "f_peacefulness", desc: true })).toEqual([2, 0, 1, 3, 4, 5, 6, 7]);
    expect(songs({}, { key: "f_peacefulness", desc: false })).toEqual([4, 5, 6, 7, 3, 1, 0, 2]); // no score first, then 0, 3, 6, 8
  });
  it("sorts hearts as numbers", () => {
    expect(songs({}, { key: "loved", desc: true })).toEqual([0, 2, 1, 3, 4, 5, 6, 7]);
  });
  it("is stable: equal rows keep their order", () => {
    expect(songs({ stars: [4, 4] }, { key: "stars", desc: false })).toEqual([1, 5, 6, 7]);
  });
  it("does not change the input", () => {
    const rows = [...ds.songs];
    sortRows(rows, { key: "name", desc: false }, "itunes");
    expect(rows.map((r) => r.ix)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });
});

describe("filterArchive", () => {
  const arch = (patch = {}, sort = noSort()) => ixs(filterArchive(ds, { ...defaultArchiveFilter(), ...patch }, sort));
  it("returns every row with no filters", () => {
    expect(arch()).toEqual([0, 1, 2]);
  });
  it("searches, and filters by category", () => {
    expect(arch({ query: "someone" })).toEqual([0, 2]);
    expect(arch({ category: "Kids" })).toEqual([0, 2]);
    expect(arch({ category: "Rock" })).toEqual([1]);
  });
  it("filters by whether the song is also in iTunes", () => {
    expect(arch({ inItunes: "in" })).toEqual([0]);
    expect(arch({ inItunes: "out" })).toEqual([1, 2]);
  });
  it("filters by CD and by artist or album chip", () => {
    expect(arch({ facet: { ...noFacet(), volume: "Mp3_1S" } })).toEqual([0, 2]);
    expect(arch({ facet: { ...noFacet(), artist: "SOMEONE", album: "album x" } })).toEqual([0, 2]);
  });
  it("sorts by a column", () => {
    expect(arch({}, { key: "in_itunes", desc: true })).toEqual([0, 1, 2]);
    expect(arch({}, { key: "track", desc: false })).toEqual([1, 0, 2]);
  });
});

describe("Feel Axes (the cube box)", () => {
  const cube = buildCube(ds.songs, ds.axes)!;
  it("the whole cube holds the rated songs", () => {
    expect(songs({ cube: { cube, box: fullBox(cube) } })).toEqual([0, 1, 2, 3]);
  });
  it("narrowing maturity leaves out songs without it", () => {
    expect(songs({ cube: { cube, box: { ...fullBox(cube), maturity: [5, 10] } } })).toEqual([0]);
  });
  it("combines with the other filters", () => {
    expect(songs({ cube: { cube, box: fullBox(cube) }, lovedOnly: true })).toEqual([0, 2]);
  });
  it("without axes data nothing passes", () => {
    expect(songs({ cube: { cube: null, box: { ranges: [], maturity: [0, 10] } } })).toEqual([]);
  });
});
