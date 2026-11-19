import { formatTime, formatTrack } from "./data/format";
import type { ArchiveRow, Song } from "./data/types";
import type { Tab } from "./state/uiState";

export interface Column {
  key: string;
  label: string;
  /** right-aligned */
  numeric?: boolean;
  /** pixels */
  width: number;
}

/** Same widths as the current page; a column without an entry is 200 px. */
const WIDTHS: Record<string, number> = {
  year: 64, loved: 48, stars: 120, plays: 64, secs: 64, country: 56, in_itunes: 84, last_played: 110, track: 56, genres: 240,
  path: 520, volume: 90, category: 140, composer: 180,
};
const col = (key: string, label: string, numeric = false): Column => ({ key, label, numeric, width: WIDTHS[key] ?? 200 });

export const SONG_COLUMNS: readonly Column[] = [
  col("name", "Name"), col("artist", "Artist"), col("album", "Album"), col("track", "Track", true), col("year", "Year", true),
  col("loved", "❤️", true), col("stars", "Rating"), col("plays", "Plays", true), col("last_played", "Last played"), col("genres", "Genres"),
  col("country", "Ctry"), col("composer", "Composer"), col("secs", "Time", true), col("path", "Path"),
];

export const ARCHIVE_COLUMNS: readonly Column[] = [
  col("name", "Name"), col("artist", "Artist"), col("album", "Album"), col("category", "Category"), col("volume", "Volume"),
  col("in_itunes", "In iTunes", true), col("path", "Path"),
];

export const columnsOf = (tab: Tab): readonly Column[] => (tab === "itunes" ? SONG_COLUMNS : ARCHIVE_COLUMNS);

/** Columns that start hidden (the column menu arrives in a later slice). */
export const HIDDEN_BY_DEFAULT: Record<Tab, ReadonlySet<string>> = { itunes: new Set(["path"]), archive: new Set() };

/** Columns whose cell click picks an artist, album or CD chip. */
export const FACET_COLUMNS: Record<string, "artist" | "album" | "volume"> = { artist: "artist", album: "album", volume: "volume" };

const isSong = (r: Song | ArchiveRow): r is Song => "feel" in r;

/** The text of a cell. (The stars column draws its own stars.) */
export function cellText(row: Song | ArchiveRow, key: string): string {
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
