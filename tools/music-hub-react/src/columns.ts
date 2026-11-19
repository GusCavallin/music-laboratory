import { FEEL_SCALES, feelColumnIndex } from "./data/feel";
import { formatTime, formatTrack } from "./data/format";
import type { ArchiveRow, FeelStat, Song } from "./data/types";
import { plain, signed } from "./feel/model";
import type { Tab } from "./state/uiState";

export interface Column {
  key: string;
  label: string;
  /** right-aligned */
  numeric?: boolean;
  /** centered (the Feel scores) */
  center?: boolean;
  /** pixels */
  width: number;
}

/** Same widths as the current page; a column without an entry is 200 px. */
const WIDTHS: Record<string, number> = {
  year: 64, loved: 48, stars: 120, plays: 64, secs: 64, country: 56, in_itunes: 84, last_played: 110, track: 56, genres: 240,
  path: 520, volume: 90, category: 140, composer: 180,
  f_wonder: 74, f_transcendence: 96, f_tenderness: 86, f_nostalgia: 84, f_peacefulness: 96, f_power: 66, f_joyful: 112, f_tension: 74,
  f_sadness: 76, f_maturity: 80, f_conf: 60,
};
const col = (key: string, label: string, numeric = false): Column => ({ key, label, numeric, width: WIDTHS[key] ?? 200 });
const score = (key: string, label: string): Column => ({ key, label, center: true, width: WIDTHS[key] ?? 200 });

export const SONG_COLUMNS: readonly Column[] = [
  col("name", "Name"), col("artist", "Artist"), col("album", "Album"), col("track", "Track", true), col("year", "Year", true),
  col("loved", "❤️", true), col("stars", "Rating"), col("plays", "Plays", true), col("last_played", "Last played"), col("genres", "Genres"),
  col("country", "Ctry"), col("composer", "Composer"), col("secs", "Time", true), col("path", "Path"),
];

export const ARCHIVE_COLUMNS: readonly Column[] = [
  col("name", "Name"), col("artist", "Artist"), col("album", "Album"), col("category", "Category"), col("volume", "Volume"),
  col("in_itunes", "In iTunes", true), col("path", "Path"),
];

/** The ten Feel scores and the confidence ("Sure"). */
export const FEEL_SCORE_COLUMNS: readonly Column[] = [
  ...FEEL_SCALES.map((s) => score(`f_${s.key}`, s.label)),
  score("f_conf", "Sure"),
];

const SONG_REST = SONG_COLUMNS.filter((c) => !["name", "artist", "stars"].includes(c.key));
const byKey = (k: string) => SONG_COLUMNS.find((c) => c.key === k)!;

/** Raw Feel: name, artist and rating first, then the scores, then the rest. */
export const FEEL_COLUMNS: readonly Column[] = [byKey("name"), byKey("artist"), byKey("stars"), ...FEEL_SCORE_COLUMNS, ...SONG_REST];

/** Feel Axes (and Raw Feel with its graph on, which hides the score columns): maturity is the only score, as it colors the dots. */
export const CUBE_COLUMNS: readonly Column[] = [
  byKey("name"), byKey("artist"), byKey("stars"), FEEL_SCORE_COLUMNS.find((c) => c.key === "f_maturity")!, ...SONG_REST,
];

/** Each tab has its own set of columns (and, later, its own hidden and order settings). */
export type ColumnGroup = "itunes" | "archive" | "feel" | "cube";

/** The column set on screen: Raw Feel with its graph on uses the Feel Axes set. */
export const groupOf = (tab: Tab, graph = false): ColumnGroup => (tab === "feel" && graph ? "cube" : tab);

const GROUPS: Record<ColumnGroup, readonly Column[]> = { itunes: SONG_COLUMNS, archive: ARCHIVE_COLUMNS, feel: FEEL_COLUMNS, cube: CUBE_COLUMNS };
export const columnsOf = (group: ColumnGroup): readonly Column[] => GROUPS[group];
export const hasColumn = (group: ColumnGroup, key: string): boolean => GROUPS[group].some((c) => c.key === key);

const FEEL_HIDDEN = ["track", "year", "loved", "plays", "last_played", "genres", "country", "composer", "secs", "path"];
/** Columns that start hidden (the column menu arrives in a later slice). */
export const HIDDEN_BY_DEFAULT: Record<ColumnGroup, ReadonlySet<string>> = {
  itunes: new Set(["path"]),
  archive: new Set(),
  feel: new Set(FEEL_HIDDEN),
  cube: new Set(FEEL_HIDDEN.filter((k) => k !== "plays")),
};

/** Columns whose cell click picks an artist, album or CD chip. */
export const FACET_COLUMNS: Record<string, "artist" | "album" | "volume"> = { artist: "artist", album: "album", volume: "volume" };

const isSong = (r: Song | ArchiveRow): r is Song => "feel" in r;

/** The text of a cell. (The stars column draws its own stars.) */
export function cellText(row: Song | ArchiveRow, key: string): string {
  const fi = feelColumnIndex(key);
  if (fi !== null) return isSong(row) ? String(row.feel?.[fi] ?? "") : "";
  switch (key) {
    case "name":
      return (isSong(row) && row.protected ? "🔒 " : "") + row.name;
    case "secs":
      return isSong(row) ? formatTime(row.secs) : "";
    case "track":
      return isSong(row) ? formatTrack(row) : row.track ? String(row.track) : "";
    case "loved":
      return isSong(row) && row.loved ? "❤️" : "";
    case "year":
      return isSong(row) && row.year ? String(row.year) : "";
    case "in_itunes":
      return !isSong(row) && row.in_itunes ? "✔" : "";
    default: {
      const v = (row as unknown as Record<string, unknown>)[key];
      return v == null ? "" : String(v);
    }
  }
}

const CONFIDENCE_WORDS = ["", "low", "medium", "high"];

/** The hover text of a Feel score: where it stands among all rated songs (any stars, hearts or category). */
export function feelTip(song: Song, key: string, stats: Record<string, FeelStat>): string {
  const fi = feelColumnIndex(key);
  if (fi === null || !song.feel) return "";
  if (key === "f_conf") return `Confidence in these ratings: ${CONFIDENCE_WORDS[song.feel[fi] ?? 0] ?? ""}`;
  const scale = FEEL_SCALES[fi]!;
  const v = song.feel[fi];
  if (v == null) return `${scale.label}: no score (an instrumental has no words to judge)`;
  const s = stats[scale.key] ?? { n: 0, mean: 0, sd: 0 };
  const d = v - s.mean;
  const z = s.sd ? d / s.sd : 0;
  return `${scale.label} ${v} · mean ${s.mean.toFixed(2)} · stdev ${s.sd.toFixed(2)} · ${signed(d, 2)} points from the mean (${signed(z, 2)} stdev) · all ${s.n.toLocaleString()} rated songs`;
}

/**
 * The background of a Feel score cell: "dev" tints it cool below the mean of its scale and warm above (full tint at ±2.5 stdev, nothing near
 * the mean); "raw" shades it by the score. Returns a CSS background value, or undefined for no tint.
 */
export function scoreBackground(value: number | null, key: string, stats: Record<string, FeelStat>, mode: "dev" | "raw"): string | undefined {
  if (value == null) return undefined;
  if (mode === "raw") return `hsl(205 80% 50% / ${plain(value * 0.06, 2)})`;
  const stat = stats[key.slice(2)];
  const z = stat && stat.sd ? (value - stat.mean) / stat.sd : 0;
  const c = Math.max(-2.5, Math.min(2.5, z));
  const pct = Math.round((Math.abs(c) / 2.5) * 55);
  return pct < 3 ? undefined : `color-mix(in srgb, var(${c > 0 ? "--warm" : "--cool"}) ${pct}%, transparent)`;
}
