import {
  noFacet, noSort, type ArchiveFilter, type Facet, type SongFilter, type SortSpec,
} from "../data/filter";

export type Tab = "itunes" | "archive";

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
  | { type: "sort"; key: string };

/** Columns whose first click sorts from the highest value down: rating, plays, hearts and the Feel scores. */
export const DESC_FIRST: ReadonlySet<string> = new Set([
  "stars", "plays", "loved",
  "f_wonder", "f_transcendence", "f_tenderness", "f_nostalgia", "f_peacefulness", "f_power", "f_joyful", "f_tension", "f_sadness",
  "f_maturity", "f_conf",
]);

/** Back to "no filters": the search box, the rating range, hearts, decade, country, playlist, category and iTunes choice. Sort stays. */
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
});

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
  }
}

/** The iTunes tab's filter, taking the search text separately so the page can search a deferred copy while you type. */
export const songFilterOf = (s: UiState, query: string = s.query): SongFilter => ({
  query,
  stars: s.stars,
  lovedOnly: s.lovedOnly,
  decade: s.decade,
  country: s.country,
  playlist: s.playlist,
  facet: s.facet,
  feel: null,
});

export const archiveFilterOf = (s: UiState, query: string = s.query): ArchiveFilter => ({
  query,
  category: s.category,
  inItunes: s.inItunes,
  facet: s.facet,
});

/** Is any filter on? (the "Clear filters" button) */
export function hasFilters(s: UiState): boolean {
  const f = s.facet;
  return (
    s.query !== "" || f.artist !== null || f.album !== null || f.volume !== null || s.stars[0] !== 0 || s.stars[1] !== 5 ||
    s.lovedOnly || s.decade !== "" || s.country !== "" || s.playlist !== "" || s.category !== "" || s.inItunes !== "any"
  );
}
