import { computeFeelStats } from "./feel";
import { fold, searchForms } from "./text";
import type { ArchiveRow, Dataset, Playlist, RawLibrary, Song } from "./types";

const str = (v: unknown): string => (v == null ? "" : String(v));
const num = (v: unknown): number => (typeof v === "number" ? v : Number(v) || 0);

/** data.js is `window.LIB = {...};`. Takes the text of that file and returns the object (the page itself loads it with a script tag). */
export function parseLibraryScript(text: string): RawLibrary {
  const body = text.trim().replace(/^window\.LIB\s*=\s*/, "").replace(/;\s*$/, "");
  return JSON.parse(body) as RawLibrary;
}

/** A row (array) and the column names become an object. */
function toObject(cols: readonly string[], row: readonly unknown[]): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  cols.forEach((c, i) => (o[c] = row[i]));
  return o;
}

export function buildDataset(raw: RawLibrary): Dataset {
  const songs: Song[] = raw.itunes.map((row, ix) => {
    const o = toObject(raw.itunes_cols, row);
    const feel = Array.isArray(o.feel) ? (o.feel as (number | null)[]) : null;
    const song: Song = {
      ix,
      name: str(o.name),
      artist: str(o.artist),
      album: str(o.album),
      composer: str(o.composer),
      genres: str(o.genres),
      country: str(o.country),
      year: num(o.year),
      stars: num(o.stars),
      loved: !!o.loved,
      plays: num(o.plays),
      last_played: str(o.last_played),
      secs: num(o.secs),
      added: str(o.added),
      bpm: num(o.bpm),
      protected: !!o.protected,
      track: num(o.track),
      tracks: num(o.tracks),
      disc: num(o.disc),
      discs: num(o.discs),
      feel,
      path: str(o.path),
      ...searchForms([str(o.name), str(o.artist), str(o.album), str(o.composer), str(o.genres)]),
      artistFold: fold(str(o.artist)),
      albumFold: fold(str(o.album)),
    };
    return song;
  });

  const archive: ArchiveRow[] = raw.archive.map((row, ix) => {
    const o = toObject(raw.archive_cols, row);
    return {
      ix,
      name: str(o.name),
      artist: str(o.artist),
      album: str(o.album),
      category: str(o.category),
      volume: str(o.volume),
      track: num(o.track),
      in_itunes: !!o.in_itunes,
      path: str(o.path),
      ...searchForms([str(o.name), str(o.artist), str(o.album), str(o.category), str(o.volume)]),
      artistFold: fold(str(o.artist)),
      albumFold: fold(str(o.album)),
    };
  });

  const playlists: Playlist[] = (raw.playlists ?? []).map(([name, ids, smart]) => ({ name, ids, smart: !!smart }));

  return {
    songs,
    archive,
    playlists,
    feelStats: computeFeelStats(songs),
    built: raw.built ?? "",
    version: raw.version ?? "",
  };
}
