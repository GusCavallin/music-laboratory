/**
 * Opt-in check against a real data.js (read-only). It asserts no numbers of its own: every expectation is computed a second,
 * naive way straight from the raw rows, so it works on any library and keeps nothing personal in the repo.
 *
 *   PowerShell:  $env:MUSICLAB_DATA_JS = "C:\path\to\tools\music-hub\data.js"; npm test
 *
 * Without the variable the whole file is skipped.
 */
import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { defaultArchiveFilter, defaultSongFilter, filterArchive, filterSongs, noFacet } from "./filter";
import { buildDataset, parseLibraryScript } from "./load";
import { fold } from "./text";
import type { Dataset, RawLibrary } from "./types";

const file = process.env.MUSICLAB_DATA_JS;

describe.skipIf(!file)("a real data.js", () => {
  let raw!: RawLibrary;
  let ds!: Dataset;
  beforeAll(() => {
    raw = parseLibraryScript(readFileSync(file!, "utf-8"));
    ds = buildDataset(raw);
  });
  const col = (name: string) => raw.itunes_cols.indexOf(name);
  const naive = (pred: (row: unknown[]) => boolean) => raw.itunes.filter(pred).length;

  it("reads every row", () => {
    expect(ds.songs).toHaveLength(raw.itunes.length);
    expect(ds.archive).toHaveLength(raw.archive.length);
    expect(ds.playlists).toHaveLength(raw.playlists.length);
  });
  it("every rated song has ten scores and a confidence", () => {
    for (const s of ds.songs) if (s.feel) expect(s.feel).toHaveLength(11);
  });
  it("star, heart, decade and country filters agree with a naive count", () => {
    const stars = col("stars"), loved = col("loved"), year = col("year"), country = col("country");
    expect(filterSongs(ds, { ...defaultSongFilter(), stars: [4, 5] })).toHaveLength(naive((r) => (r[stars] as number) >= 4));
    expect(filterSongs(ds, { ...defaultSongFilter(), lovedOnly: true })).toHaveLength(naive((r) => !!r[loved]));
    expect(filterSongs(ds, { ...defaultSongFilter(), decade: "1990s" })).toHaveLength(
      naive((r) => Math.floor((r[year] as number) / 10) * 10 === 1990),
    );
    const some = ds.songs.find((s) => s.country)?.country;
    if (some) expect(filterSongs(ds, { ...defaultSongFilter(), country: some })).toHaveLength(naive((r) => r[country] === some));
  });
  it("a playlist filter returns each of its songs once", () => {
    const pl = ds.playlists.find((p) => p.ids.length > 1);
    if (!pl) return;
    const out = filterSongs(ds, { ...defaultSongFilter(), playlist: pl.name });
    expect(out.map((s) => s.ix)).toEqual([...new Set(pl.ids)]);
  });
  it("a song is found by a word of its own name, and by its artist chip", () => {
    for (const s of ds.songs.filter((x) => /^[A-Za-z]{4,}/.test(x.name)).slice(0, 200)) {
      const word = s.name.split(/\s+/)[0]!;
      expect(filterSongs(ds, { ...defaultSongFilter(), query: word }).map((x) => x.ix)).toContain(s.ix);
    }
    const artist = ds.songs.find((s) => s.artist)?.artist;
    if (artist) {
      const out = filterSongs(ds, { ...defaultSongFilter(), facet: { ...noFacet(), artist } });
      expect(out.length).toBeGreaterThan(0);
      expect(out.every((s) => fold(s.artist) === fold(artist))).toBe(true);
    }
  });
  it("an album sort keeps each album in disc and track order", () => {
    const out = filterSongs(ds, defaultSongFilter(), { key: "album", desc: false });
    for (let i = 1; i < out.length; i++) {
      const a = out[i - 1]!, b = out[i]!;
      if (a.album === b.album && a.artist === b.artist) expect(a.disc < b.disc || (a.disc === b.disc && a.track <= b.track)).toBe(true);
    }
  });
  it("the archive filters agree with a naive count", () => {
    const inIt = raw.archive_cols.indexOf("in_itunes");
    expect(filterArchive(ds, { ...defaultArchiveFilter(), inItunes: "in" })).toHaveLength(raw.archive.filter((r) => !!r[inIt]).length);
    expect(filterArchive(ds, { ...defaultArchiveFilter(), inItunes: "out" })).toHaveLength(raw.archive.filter((r) => !r[inIt]).length);
  });
});
