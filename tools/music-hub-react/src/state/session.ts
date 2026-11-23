import { legacyToView, viewToLegacy, type LegacyView } from "./legacy";
import { initialUiState, type Tab, type UiState } from "./uiState";

/**
 * What is remembered between visits, in the format of the current page ("ls_session"): the view (tab, filters, chips, sort, Feel sliders), whether
 * shuffle was on, and the song that was playing with its position. The Feel Axes box is not part of it: it starts as the whole cube.
 */
export interface SavedSession {
  src: "itunes" | "archive";
  feel: boolean;
  cube: boolean;
  shuf: boolean;
  facet: LegacyView["facet"];
  sort: LegacyView["sort"];
  loved: boolean;
  g: boolean;
  fo: number[];
  lk: string[];
  f: LegacyView["f"];
  /** the song that was playing (its file path) and where, in seconds */
  song: { path: string; t: number } | null;
}

export const SESSION_KEY = "ls_session";

export interface Storage_ {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** The view and the player's state, as stored. */
export function toSession(ui: UiState, shuffle: boolean, song: { path: string; t: number } | null): SavedSession {
  const v = viewToLegacy(ui);
  return {
    src: ui.tab === "archive" ? "archive" : "itunes",
    feel: ui.tab === "feel",
    cube: ui.tab === "cube",
    shuf: shuffle,
    facet: v.facet,
    sort: v.sort,
    loved: v.loved,
    g: v.g,
    fo: v.fo,
    lk: v.lk ?? [],
    f: v.f,
    song,
  };
}

/** The view a stored session describes (on top of `base`), and whether shuffle was on. */
export function fromSession(saved: unknown, base: UiState = initialUiState()): { ui: UiState; shuffle: boolean; song: { path: string; t: number } | null } {
  if (typeof saved !== "object" || saved === null) return { ui: base, shuffle: false, song: null };
  const s = saved as Partial<SavedSession>;
  const tab: Tab = s.src === "archive" ? "archive" : s.cube ? "cube" : s.feel ? "feel" : "itunes";
  const ui = legacyToView({ tab, f: s.f, loved: s.loved, facet: s.facet, g: s.g, fo: s.fo, lk: s.lk, sort: s.sort }, base);
  const song = s.song && typeof s.song.path === "string" ? { path: s.song.path, t: Number(s.song.t) > 0 ? Number(s.song.t) : 0 } : null;
  return { ui, shuffle: !!s.shuf, song };
}

/** Reads the stored session; null when there is none or it is unusable (storage can be blocked, the text can be damaged). */
export function loadSession(storage: Storage_ = localStorage): unknown | null {
  try {
    return JSON.parse(storage.getItem(SESSION_KEY) ?? "null");
  } catch {
    return null;
  }
}

/** Stores it; a page that cannot store anything simply forgets. */
export function writeSession(session: SavedSession, storage: Storage_ = localStorage): void {
  try {
    storage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    /* not remembered */
  }
}

/**
 * A view from an earlier visit (or a preset) can name things the library no longer has: a playlist that was deleted, a decade nobody has now. Those
 * choices are dropped, the rest stays. The MP3 Archive tab is only there when the library has an archive (`hasArchive`, true when left out), so a view
 * that was on it opens on the iTunes tab instead.
 */
export function fitToLibrary(ui: UiState, library: { playlists: readonly string[]; decades: readonly string[]; countries: readonly string[]; categories: readonly string[]; hasArchive?: boolean }): UiState {
  const keep = (value: string, all: readonly string[]) => (value === "" || all.includes(value) ? value : "");
  const next = {
    decade: keep(ui.decade, library.decades),
    country: keep(ui.country, library.countries),
    playlist: keep(ui.playlist, library.playlists),
    category: keep(ui.category, library.categories),
    tab: ui.tab === "archive" && library.hasArchive === false ? ("itunes" as const) : ui.tab,
  };
  return next.decade === ui.decade && next.country === ui.country && next.playlist === ui.playlist && next.category === ui.category && next.tab === ui.tab ? ui : { ...ui, ...next };
}
