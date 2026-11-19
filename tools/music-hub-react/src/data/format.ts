import type { Song } from "./types";

/** 227 seconds become "3:47". */
export const formatTime = (secs: number): string => `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;

/** "5/13": track 5 of 13; "2-5/12" on a multi-disc album (disc 2, track 5 of the 12 on that disc); "" when the tags are empty. */
export function formatTrack(s: Pick<Song, "track" | "tracks" | "disc" | "discs">): string {
  if (!s.track) return "";
  return `${s.discs > 1 ? `${s.disc}-` : ""}${s.track}${s.tracks ? `/${s.tracks}` : ""}`;
}

export const formatStars = (stars: number): string => (stars ? "⭐".repeat(stars) : "");

/** The decade filter value of a year: 1994 becomes "1990s". */
export const decadeOf = (year: number): string => `${Math.floor(year / 10) * 10}s`;
