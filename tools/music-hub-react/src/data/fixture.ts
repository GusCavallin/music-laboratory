import type { RawLibrary } from "./types";

/** An invented library for the tests (made-up songs; never the real one). Column order is the one build_data.py writes. */
const ITUNES_COLS = [
  "name", "artist", "album", "composer", "genres", "country", "year", "stars", "loved", "plays", "last_played",
  "secs", "added", "bpm", "protected", "track", "tracks", "disc", "discs", "feel", "path",
];

// feel: wonder, transcendence, tenderness, nostalgia, peacefulness, power, joyful, tension, sadness, maturity, confidence
const FEEL_A = [3, 3, 4, 5, 6, 1, 2, 2, 3, 7, 3];
const FEEL_B = [2, 1, 2, 4, 3, 5, 8, 2, 2, 4, 3];
const FEEL_C = [7, 7, 5, 5, 8, 2, 1, 2, 3, null, 2]; // an instrumental: no maturity
const FEEL_D = [1, 1, 1, 2, 0, 9, 6, 5, 1, 3, 3];

const song = (
  name: string, artist: string, album: string, composer: string, genres: string, country: string, year: number,
  stars: number, loved: number, track: number, tracks: number, disc: number, discs: number, feel: (number | null)[] | null,
): unknown[] => [
  name, artist, album, composer, genres, country, year, stars, loved, 10, "2026-01-02", 200, "2020-01-01", 0, 0,
  track, tracks, disc, discs, feel, `C:\\music\\${name}.mp3`,
];

export const fixtureLibrary = (): RawLibrary => ({
  itunes_cols: ITUNES_COLS,
  itunes: [
    /* 0 */ song("Spider Man Theme", "The Webs", "Heroes", "", "rock", "US", 1994, 5, 1, 1, 10, 1, 1, FEEL_A),
    /* 1 */ song("Take On Me", "a-ha", "Hunting High and Low", "", "pop", "NO", 1985, 4, 0, 1, 6, 1, 1, FEEL_B),
    /* 2 */ song("Largo", "Antonín Dvořák", "New World Symphony", "Antonín Dvořák", "classical", "CZ", 1893, 5, 1, 2, 4, 1, 1, FEEL_C),
    /* 3 */ song("Highway to Hell", "AC/DC", "Highway to Hell", "", "rock", "AU", 1979, 3, 0, 1, 10, 1, 1, FEEL_D),
    /* 4 */ song("Unrated Song", "Nobody", "Blank", "", "", "", 0, 0, 0, 0, 0, 0, 0, null),
    /* 5 */ song("Disc 2 Track 1", "Duo", "Double", "", "", "", 0, 4, 0, 1, 2, 2, 2, null),
    /* 6 */ song("Disc 1 Track 2", "Duo", "Double", "", "", "", 0, 4, 0, 2, 2, 1, 2, null),
    /* 7 */ song("Disc 1 Track 1", "Duo", "Double", "", "", "", 0, 4, 0, 1, 2, 1, 2, null),
  ],
  playlists: [
    ["Road Trip", [3, 0, 3, 1], 0], // song 3 is listed twice: its first position counts
    ["Smart Mix", [0], 1],
  ],
  archive_cols: ["name", "artist", "album", "category", "volume", "track", "in_itunes", "path"],
  archive: [
    ["Lullaby", "Someone", "Album X", "Kids", "Mp3_1S", 3, 1, "$DL\\a.mp3"],
    ["Song Y", "Other", "Album Y", "Rock", "Mp3_2D", 1, 0, "$DL\\b.mp3"],
    ["Song Z", "Someone", "Album X", "Kids", "Mp3_1S", 4, 0, "$DL\\c.mp3"],
  ],
  // invented: nine means and spreads and three axes (loadings in the order of the nine scales, wonder .. sadness)
  axes: {
    mean: [3, 3, 3, 4, 4, 4, 4, 3, 3],
    sd: [2, 2, 2, 2, 2, 2, 2, 2, 2],
    axes: [
      { name: "Calm", low: "Bright · strong", high: "Calm · tender", loadings: [0, 0, 0.5, 0.2, 0.5, -0.4, -0.2, 0, 0], eigenvalue: 4 },
      { name: "Ease", low: "Demanding · intense", high: "Easy · cheerful", loadings: [0, 0, 0, 0, 0, 0, 0.5, -0.5, -0.5], eigenvalue: 1 },
      { name: "Awe", low: "Down-to-earth", high: "Awe · grandeur", loadings: [0.5, 0.5, 0, 0, 0, 0.3, 0, 0, 0], eigenvalue: 1 },
    ],
  },
  built: "2026-11-19 10:00",
  version: "0.2.0",
});
