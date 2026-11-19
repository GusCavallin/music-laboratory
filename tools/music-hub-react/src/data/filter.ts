import { passesCube, type Cube, type CubeBox } from "../feel/cube";
import { feelColumnIndex, fullFeelRanges, passesFeel, type FeelRanges } from "./feel";
import { fold, matchesTerms, parseTerms } from "./text";
import type { ArchiveRow, Dataset, Song } from "./types";

/** Artist/album/CD picked by clicking a cell (the "chips"). null = no chip. */
export interface Facet {
  artist: string | null;
  album: string | null;
  volume: string | null;
}

export const noFacet = (): Facet => ({ artist: null, album: null, volume: null });

/** Column to sort by (null = the natural order), and the direction. */
export interface SortSpec {
  key: string | null;
  desc: boolean;
}

export const noSort = (): SortSpec => ({ key: null, desc: false });

/** Everything the iTunes tab (and the Raw Feel view of it) filters by. */
export interface SongFilter {
  query: string;
  stars: [min: number, max: number];
  lovedOnly: boolean;
  /** "1990s", or "" for any */
  decade: string;
  country: string;
  /** exact playlist name; "" or an unknown name filters nothing */
  playlist: string;
  facet: Facet;
  /** the Raw Feel view: null = off (every song is a candidate) */
  feel: { ranges: FeelRanges; confidence: number } | null;
  /** the Feel Axes view: the cube and the box you sized (null = off). Without a cube (no axes data) nothing passes. */
  cube: { cube: Cube | null; box: CubeBox } | null;
}

export const defaultSongFilter = (): SongFilter => ({
  query: "",
  stars: [0, 5],
  lovedOnly: false,
  decade: "",
  country: "",
  playlist: "",
  facet: noFacet(),
  feel: null,
  cube: null,
});

/** Everything the MP3 archive tab filters by. */
export interface ArchiveFilter {
  query: string;
  category: string;
  /** "any", songs also in iTunes ("in"), or only on the CDs ("out") */
  inItunes: "any" | "in" | "out";
  facet: Facet;
}

export const defaultArchiveFilter = (): ArchiveFilter => ({ query: "", category: "", inItunes: "any", facet: noFacet() });

export { fullFeelRanges };

/** Filters the iTunes songs. With a playlist chosen and no sort, the result is in playlist order. */
export function filterSongs(ds: Dataset, f: SongFilter, sort: SortSpec = noSort()): Song[] {
  const terms = parseTerms(f.query);
  const playlist = f.playlist ? ds.playlists.find((p) => p.name === f.playlist) : undefined; // text that is not (yet) a playlist name filters nothing
  // a song listed twice keeps its first position
  const rank = playlist ? new Map([...playlist.ids.entries()].map(([pos, ix]) => [ix, pos] as const).reverse()) : null;
  const artist = f.facet.artist ? fold(f.facet.artist) : null;
  const album = f.facet.album ? fold(f.facet.album) : null;
  const [minStars, maxStars] = f.stars;

  const out = ds.songs.filter((s) => {
    if (rank && !rank.has(s.ix)) return false;
    if (!matchesTerms(s, terms)) return false;
    if (artist !== null && s.artistFold !== artist) return false;
    if (album !== null && s.albumFold !== album) return false;
    if (f.feel && !passesFeel(s, f.feel.ranges, f.feel.confidence)) return false;
    if (f.cube && !(f.cube.cube && passesCube(f.cube.cube, s, f.cube.box))) return false;
    if (s.stars < minStars || s.stars > maxStars || (f.lovedOnly && !s.loved)) return false;
    if (f.decade && `${Math.floor(s.year / 10) * 10}s` !== f.decade) return false;
    if (f.country && s.country !== f.country) return false;
    return true;
  });

  if (rank && !sort.key) out.sort((x, y) => rank.get(x.ix)! - rank.get(y.ix)!);
  return sortRows(out, sort, "itunes");
}

/** Filters the archive rows. */
export function filterArchive(ds: Dataset, f: ArchiveFilter, sort: SortSpec = noSort()): ArchiveRow[] {
  const terms = parseTerms(f.query);
  const artist = f.facet.artist ? fold(f.facet.artist) : null;
  const album = f.facet.album ? fold(f.facet.album) : null;
  const out = ds.archive.filter((r) => {
    if (!matchesTerms(r, terms)) return false;
    if (f.facet.volume !== null && r.volume !== f.facet.volume) return false;
    if (artist !== null && r.artistFold !== artist) return false;
    if (album !== null && r.albumFold !== album) return false;
    if (f.category && r.category !== f.category) return false;
    if (f.inItunes === "in" && !r.in_itunes) return false;
    if (f.inItunes === "out" && r.in_itunes) return false;
    return true;
  });
  return sortRows(out, sort, "archive");
}

type Cell = string | number | boolean | null | undefined;

/** The value a column sorts by: the field itself, or the Feel score for "f_wonder" ... "f_conf" columns (null when there is none). */
function sortValue(row: Song | ArchiveRow, key: string): Cell {
  const fi = feelColumnIndex(key);
  if (fi !== null) return "feel" in row ? (row.feel?.[fi] ?? null) : null;
  const v = (row as unknown as Record<string, Cell>)[key];
  return typeof v === "boolean" ? Number(v) : v;
}

/** Rows that have no value sort before every value (as in the current page), and equal rows keep their order. */
function compare(a: Cell, b: Cell): number {
  if (a === b) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  return a > b ? 1 : a < b ? -1 : 0;
}

/** Sorts a copy. An album sort on the iTunes tab keeps each album together, in disc and track order. */
export function sortRows<T extends Song | ArchiveRow>(rows: readonly T[], sort: SortSpec, tab: "itunes" | "archive"): T[] {
  const out = [...rows];
  const key = sort.key;
  if (!key) return out;
  const keys = key === "album" && tab === "itunes" ? ["album", "artist", "disc", "track"] : [key];
  const dir = sort.desc ? -1 : 1;
  out.sort((x, y) => {
    for (const k of keys) {
      const c = compare(sortValue(x, k), sortValue(y, k));
      if (c !== 0) return c * dir;
    }
    return 0;
  });
  return out;
}
