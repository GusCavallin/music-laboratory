/** One of the three independent axes of the Feel Axes tab (tools/emotions/axes.py): a principal component of the nine GEMS scales. */
export interface RawAxis {
  name: string;
  /** the two ends, "Calm · tender": the part before " · " is the short label */
  low: string;
  high: string;
  /** one weight per GEMS scale (the nine, not maturity) */
  loadings: number[];
  eigenvalue: number;
}

/** What axes.json holds: the mean and spread of each of the nine scales over all rated songs, and the axes. */
export interface RawAxes {
  mean: number[];
  sd: number[];
  axes: RawAxis[];
}

/** What build_data.py writes into data.js (window.LIB = {...}). Rows are arrays; the *_cols lists name their positions. */
export interface RawLibrary {
  itunes_cols: string[];
  itunes: unknown[][];
  /** [full name, row indexes into `itunes`, 1 = smart playlist] */
  playlists: [string, number[], number][];
  archive_cols: string[];
  archive: unknown[][];
  /** null until tools/emotions/axes.py has been run */
  axes: RawAxes | null;
  built: string;
  version: string;
}

/** Text prepared once per row so every keystroke only does string.includes (see text.ts). */
export interface Searchable {
  /** punctuation as word breaks: " spider man " */
  h: string;
  /** punctuation joined: " spiderman " ("aha" for a-ha) */
  j: string;
  /** artist and album without capitals or accents, for the exact-name chips */
  artistFold: string;
  albumFold: string;
}

/** One song of the iTunes library. `feel` is the ten scale scores (0-10, null = n/a) followed by the confidence (1-3), or null if unrated. */
export interface Song extends Searchable {
  /** position in data.js (playlists refer to it) */
  ix: number;
  name: string;
  artist: string;
  album: string;
  composer: string;
  genres: string;
  country: string;
  /** original release year; 0 = unknown */
  year: number;
  stars: number;
  loved: boolean;
  plays: number;
  /** "YYYY-MM-DD" or "" */
  last_played: string;
  secs: number;
  added: string;
  /** 0 = no tempo known */
  bpm: number;
  /** copy-protected purchase: a browser cannot play it */
  protected: boolean;
  /** 0 = not set; `tracks` is the number of tracks on that disc */
  track: number;
  tracks: number;
  disc: number;
  discs: number;
  feel: (number | null)[] | null;
  /** Windows path of the file */
  path: string;
}

/** One row of the old MP3 archive (the CD index). */
export interface ArchiveRow extends Searchable {
  ix: number;
  name: string;
  artist: string;
  album: string;
  category: string;
  /** the CD id, such as "Mp3_1S" */
  volume: string;
  track: number;
  /** also in the iTunes library (the column key stays in_itunes, like last_played, because sorting works by column key) */
  in_itunes: boolean;
  path: string;
}

export interface Playlist {
  name: string;
  /** row indexes into the songs, in playlist order */
  ids: number[];
  smart: boolean;
}

/** Mean and sample standard deviation of one Feel scale over all rated songs. */
export interface FeelStat {
  n: number;
  mean: number;
  sd: number;
}

export interface Dataset {
  songs: Song[];
  archive: ArchiveRow[];
  playlists: Playlist[];
  feelStats: Record<string, FeelStat>;
  /** the Feel Axes definition, or null */
  axes: RawAxes | null;
  built: string;
  version: string;
}
