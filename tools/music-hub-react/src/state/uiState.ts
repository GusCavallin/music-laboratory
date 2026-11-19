import { hasColumn, groupOf } from "../columns";
import { noFacet, noSort, type ArchiveFilter, type Facet, type SongFilter, type SortSpec } from "../data/filter";
import { fullBox, maturityNarrowed, type Cube, type CubeBox } from "../feel/cube";
import {
  confidenceValue, initialFeel, resetFeelSliders, setFeelRange, toggleFeelLink, type FeelState,
} from "../feel/feelState";
import type { ConfidenceChoice } from "../data/feel";

/** The four tabs: the iTunes list, the Raw Feel sliders, the Feel Axes cube, and the old MP3 archive. */
export type Tab = "itunes" | "feel" | "cube" | "archive";

/** A tab that lists iTunes songs (all but the archive). */
export const isSongTab = (tab: Tab): boolean => tab !== "archive";

/** The box of the Feel Axes tab. `ranges` null = the whole cube (the bounds come from the data, so they are not stored until a slider moves). */
export interface CubeUi {
  ranges: [number, number][] | null;
  maturity: [number, number];
  /** "cube" (3D) or "flat" (three 2D plots) */
  view: "cube" | "flat";
}

export const initialCubeUi = (): CubeUi => ({ ranges: null, maturity: [0, 10], view: "cube" });

/**
 * Everything the user has chosen on screen. One flat state, like the controls of the current page: the search box, the chips and the
 * filters keep their values when you switch tabs.
 */
export interface UiState {
  tab: Tab;
  query: string;
  facet: Facet;
  /** the rating range, from and to */
  stars: [number, number];
  lovedOnly: boolean;
  decade: string;
  country: string;
  playlist: string;
  category: string;
  inItunes: "any" | "in" | "out";
  sort: SortSpec;
  feel: FeelState;
  cube: CubeUi;
}

export const initialUiState = (): UiState => ({
  tab: "itunes",
  query: "",
  facet: noFacet(),
  stars: [0, 5],
  lovedOnly: false,
  decade: "",
  country: "",
  playlist: "",
  category: "",
  inItunes: "any",
  sort: noSort(),
  feel: initialFeel(),
  cube: initialCubeUi(),
});

export type Action =
  | { type: "tab"; tab: Tab }
  | { type: "query"; value: string }
  | { type: "starsFrom"; value: number }
  | { type: "starsTo"; value: number }
  | { type: "loved"; value: boolean }
  | { type: "decade"; value: string }
  | { type: "country"; value: string }
  | { type: "playlist"; value: string }
  | { type: "category"; value: string }
  | { type: "inItunes"; value: "any" | "in" | "out" }
  /** a click on an artist, album or CD cell; `keep` (Ctrl-click) keeps the other filters */
  | { type: "facet"; kind: keyof Facet; value: string; keep: boolean }
  | { type: "removeFacet"; kind: keyof Facet }
  | { type: "clear" }
  /** a click on a column header */
  | { type: "sort"; key: string }
  /** the sorted column was hidden: back to the library's own order */
  | { type: "dropSort" }
  // Raw Feel
  | { type: "feelRange"; index: number; which: "lo" | "hi"; value: number }
  | { type: "feelLink"; pair: string }
  | { type: "feelReset" }
  | { type: "feelConfidence"; value: ConfidenceChoice }
  | { type: "feelGraph"; value: boolean }
  | { type: "feelColor"; value: "dev" | "raw" }
  // Feel Axes: `index` 0 to 2 is an axis (its `bounds` are the whole range, needed the first time one moves), "m" is maturity
  | { type: "cubeRange"; index: 0 | 1 | 2 | "m"; which: "lo" | "hi"; value: number; bounds: [number, number][] }
  | { type: "cubeReset" }
  | { type: "cubeView"; value: "cube" | "flat" };

/** Columns whose first click sorts from the highest value down: rating, plays, hearts and the Feel scores. */
export const DESC_FIRST: ReadonlySet<string> = new Set([
  "stars", "plays", "loved",
  "f_wonder", "f_transcendence", "f_tenderness", "f_nostalgia", "f_peacefulness", "f_power", "f_joyful", "f_tension", "f_sadness",
  "f_maturity", "f_conf",
]);

/** Back to "no filters": the search box, the rating range, hearts, decade, country, playlist, category, iTunes choice, the Feel sliders and the cube box. Sort stays. */
const withoutFilters = (s: UiState): UiState => ({
  ...s,
  query: "",
  stars: [0, 5],
  lovedOnly: false,
  decade: "",
  country: "",
  playlist: "",
  category: "",
  inItunes: "any",
  feel: resetFeelSliders(s.feel),
  cube: { ...s.cube, ranges: null, maturity: [0, 10] },
});

/** A sort on a column the new set of columns does not have is dropped. */
const keepSort = (next: UiState): SortSpec =>
  next.sort.key && !hasColumn(groupOf(next.tab, next.feel.graph), next.sort.key) ? noSort() : next.sort;

export function reduce(s: UiState, a: Action): UiState {
  switch (a.type) {
    case "tab":
      if (a.tab === s.tab) return s;
      // a new tab starts unsorted; a CD chip means nothing outside the archive
      return { ...s, tab: a.tab, sort: noSort(), facet: a.tab === "archive" ? s.facet : { ...s.facet, volume: null } };
    case "query":
      return { ...s, query: a.value };
    case "starsFrom":
      return { ...s, stars: [a.value, s.stars[1]] };
    case "starsTo":
      return { ...s, stars: [s.stars[0], a.value] };
    case "loved":
      return { ...s, lovedOnly: a.value };
    case "decade":
      return { ...s, decade: a.value };
    case "country":
      return { ...s, country: a.value };
    case "playlist":
      return { ...s, playlist: a.value };
    case "category":
      return { ...s, category: a.value };
    case "inItunes":
      return { ...s, inItunes: a.value };
    case "facet": {
      const base = a.keep ? s : { ...withoutFilters(s), facet: noFacet() };
      return { ...base, facet: { ...base.facet, [a.kind]: a.value } };
    }
    case "removeFacet":
      return { ...s, facet: { ...s.facet, [a.kind]: null } };
    case "clear":
      return { ...withoutFilters(s), facet: noFacet() };
    case "sort":
      return {
        ...s,
        sort: { key: a.key, desc: s.sort.key === a.key ? !s.sort.desc : DESC_FIRST.has(a.key) },
      };
    case "dropSort":
      return s.sort.key === null ? s : { ...s, sort: noSort() };
    case "feelRange":
      return { ...s, feel: setFeelRange(s.feel, a.index, a.which, a.value) };
    case "feelLink":
      return { ...s, feel: toggleFeelLink(s.feel, a.pair) };
    case "feelReset":
      return { ...s, feel: resetFeelSliders(s.feel) };
    case "feelConfidence":
      return { ...s, feel: { ...s.feel, confidence: a.value } };
    case "feelGraph": {
      const next = { ...s, feel: { ...s.feel, graph: a.value } };
      return { ...next, sort: keepSort(next) }; // the graph hides the score columns: a sort on one of them ends
    }
    case "feelColor":
      return { ...s, feel: { ...s.feel, color: a.value } };
    case "cubeRange": {
      if (a.index === "m") {
        const [lo, hi] = s.cube.maturity;
        const v = Math.max(0, Math.min(10, Math.round(a.value)));
        const next: [number, number] = a.which === "lo" ? [v, Math.max(v, hi)] : [Math.min(lo, v), v];
        return { ...s, cube: { ...s.cube, maturity: next } };
      }
      const ranges = (s.cube.ranges ?? a.bounds).map((r): [number, number] => [r[0], r[1]]);
      const [lo, hi] = ranges[a.index]!;
      const v = Math.round(a.value * 10) / 10;
      ranges[a.index] = a.which === "lo" ? [v, Math.max(v, hi)] : [Math.min(lo, v), v];
      return { ...s, cube: { ...s.cube, ranges } };
    }
    case "cubeReset":
      return { ...s, cube: { ...s.cube, ranges: null, maturity: [0, 10] } };
    case "cubeView":
      return { ...s, cube: { ...s.cube, view: a.value } };
  }
}

/** The box of the Feel Axes tab: what the sliders hold, or the whole cube. */
export const cubeBoxOf = (s: UiState, cube: Cube): CubeBox => {
  const full = fullBox(cube);
  return { ranges: s.cube.ranges ?? full.ranges, maturity: s.cube.maturity };
};

/** The filter of a song tab, taking the search text separately so the page can search a deferred copy while you type. */
export const songFilterOf = (s: UiState, query: string = s.query, cube: Cube | null = null): SongFilter => ({
  query,
  stars: s.stars,
  lovedOnly: s.lovedOnly,
  decade: s.decade,
  country: s.country,
  playlist: s.playlist,
  facet: s.facet,
  feel: s.tab === "feel" ? { ranges: s.feel.ranges, confidence: confidenceValue(s.feel) } : null,
  cube: s.tab === "cube" ? { cube, box: cube ? cubeBoxOf(s, cube) : { ranges: [], maturity: s.cube.maturity } } : null,
});

export const archiveFilterOf = (s: UiState, query: string = s.query): ArchiveFilter => ({
  query,
  category: s.category,
  inItunes: s.inItunes,
  facet: s.facet,
});

/** Is any filter on? */
export function hasFilters(s: UiState): boolean {
  const f = s.facet;
  return (
    s.query !== "" || f.artist !== null || f.album !== null || f.volume !== null || s.stars[0] !== 0 || s.stars[1] !== 5 ||
    s.lovedOnly || s.decade !== "" || s.country !== "" || s.playlist !== "" || s.category !== "" || s.inItunes !== "any" ||
    s.feel.order.length > 0 || s.feel.confidence !== "all" || s.cube.ranges !== null || maturityNarrowed(s.cube.maturity)
  );
}
