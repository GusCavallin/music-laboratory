import { formatTime } from "../data/format";
import type { Song } from "../data/types";

/**
 * The play queue, as plain data and a reducer (the audio element is the hook's business). The queue is a snapshot of the list taken when
 * playback starts, so changing a filter never interrupts the song: the queue goes "stale", and the next song then comes from the new list.
 */
export interface QueueState {
  /** the snapshot of the list */
  songs: Song[];
  /** the order of play: indexes into `songs` (shuffled or not) */
  order: number[];
  /** where in `order` we are; -1 = nowhere yet */
  pos: number;
  current: Song | null;
  shuffle: boolean;
  /** the list has changed since the snapshot was taken */
  stale: boolean;
  /** songs in a row that could not be played (protected, or the audio failed) */
  errs: number;
  /** a protected purchase the queue landed on: a browser can't play it, so the hook says so and goes on after a pause */
  skipping: Song | null;
  /** playback gave up: only protected songs came up, or several songs in a row failed */
  halted: null | "protected" | "errors";
  /** goes up each time a song is started (or playback stopped): the audio plays again when it changes, even for the same song */
  serial: number;
  /** the song was brought back from the last visit and waits, paused, at this many seconds; null once anything is played */
  resume: number | null;
}

export const MAX_ERRORS = 5;

/** A random number in [0, 1); injectable so tests can shuffle the same way every time. */
export type Rng = () => number;

export const idleQueue = (): QueueState => ({
  songs: [], order: [], pos: -1, current: null, shuffle: false, stale: false, errs: 0, skipping: null, halted: null, serial: 0, resume: null,
});

/** The order of play for n songs: 0..n-1, or shuffled with `first` (if any) played first. */
export function playOrder(n: number, shuffle: boolean, first: number, rng: Rng): number[] {
  const order = Array.from({ length: n }, (_, i) => i);
  if (!shuffle) return order;
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  if (first >= 0) {
    order.splice(order.indexOf(first), 1);
    order.unshift(first);
  }
  return order;
}

/** Moves to a place in the order (wrapping round), landing on that song, or on a protected one, which is skipped. */
function landOn(s: QueueState, p: number): QueueState {
  const n = s.order.length;
  if (!n) return s;
  const pos = ((p % n) + n) % n;
  const song = s.songs[s.order[pos]!]!;
  if (song.protected) {
    const errs = s.errs + 1;
    return errs < MAX_ERRORS ? { ...s, pos, errs, skipping: song, halted: null } : { ...s, pos, errs: 0, skipping: null, halted: "protected" };
  }
  return { ...s, pos, current: song, skipping: null, halted: null, serial: s.serial + 1, resume: null };
}

/** A fresh snapshot of the list that keeps the playing song's place. */
function resnapshot(s: QueueState, rows: readonly Song[], rng: Rng): QueueState {
  const songs = [...rows];
  const first = s.current ? songs.findIndex((x) => x.path === s.current!.path) : -1;
  const order = playOrder(songs.length, s.shuffle, first, rng);
  return { ...s, songs, order, pos: first >= 0 ? order.indexOf(first) : -1, stale: false };
}

export type QueueAction =
  /** start playing the list: at `index`, or (null) at the top, or at a random song when shuffling */
  | { type: "start"; rows: readonly Song[]; index: number | null; rng?: Rng }
  /** the song of the last visit comes back paused at `t` seconds. `index` is its place in `rows` (-1: not in the list, so the queue is just that song) */
  | { type: "restore"; song: Song; rows: readonly Song[]; index: number; t: number; rng?: Rng }
  | { type: "goto"; pos: number }
  | { type: "next"; rows: readonly Song[]; rng?: Rng }
  | { type: "prev"; rows: readonly Song[]; rng?: Rng }
  | { type: "shuffle"; value: boolean; rng?: Rng }
  /** the list changed: the next song will come from the new list */
  | { type: "stale" }
  | { type: "stop" }
  /** the audio is playing: earlier failures are forgotten */
  | { type: "playing" }
  /** the audio element could not load the song */
  | { type: "error" };

export function queueReducer(s: QueueState, a: QueueAction): QueueState {
  switch (a.type) {
    case "start": {
      const rng = a.rng ?? Math.random;
      if (a.index !== null && a.rows[a.index]?.protected) return s; // the caller says why (a protected purchase can't play in a browser)
      if (!a.rows.length) return s;
      const first = a.index ?? (s.shuffle ? Math.floor(rng() * a.rows.length) : 0);
      const order = playOrder(a.rows.length, s.shuffle, first, rng);
      const pos = order.indexOf(first);
      return landOn({ ...s, songs: [...a.rows], order, pos, stale: false }, pos);
    }
    case "restore": {
      if (a.song.protected) return s;
      const inList = a.index >= 0 && a.rows[a.index]?.path === a.song.path;
      const songs = inList ? [...a.rows] : [a.song];
      const first = inList ? a.index : 0;
      const order = playOrder(songs.length, s.shuffle, first, a.rng ?? Math.random);
      return { ...s, songs, order, pos: order.indexOf(first), current: a.song, stale: !inList, errs: 0, skipping: null, halted: null, serial: s.serial + 1, resume: Math.max(0, Math.floor(a.t)) };
    }
    case "goto":
      return landOn(s, a.pos);
    case "next": {
      const next = s.stale ? resnapshot(s, a.rows, a.rng ?? Math.random) : s;
      return next.songs.length ? landOn(next, next.pos + 1) : queueReducer(next, { type: "start", rows: a.rows, index: null, rng: a.rng });
    }
    case "prev": {
      const prev = s.stale ? resnapshot(s, a.rows, a.rng ?? Math.random) : s;
      return prev.songs.length ? landOn(prev, prev.pos < 0 ? 0 : prev.pos - 1) : queueReducer(prev, { type: "start", rows: a.rows, index: null, rng: a.rng });
    }
    case "shuffle": {
      const next = { ...s, shuffle: a.value };
      if (!next.songs.length || next.stale) return next;
      const first = s.current ? next.songs.findIndex((x) => x.path === s.current!.path) : -1;
      const order = playOrder(next.songs.length, a.value, first, a.rng ?? Math.random);
      return { ...next, order, pos: first >= 0 ? order.indexOf(first) : -1 };
    }
    case "stale":
      return s.songs.length && !s.stale ? { ...s, stale: true } : s;
    case "stop":
      return { ...idleQueue(), shuffle: s.shuffle, serial: s.serial + 1 };
    case "playing":
      return s.errs || s.resume !== null ? { ...s, errs: 0, resume: null } : s;
    case "error": {
      const errs = s.errs + 1;
      return { ...s, errs, halted: errs >= MAX_ERRORS ? "errors" : s.halted };
    }
  }
}

/** What the "now playing" line says (null: nothing is playing, so the idle text shows). */
export function nowText(s: QueueState): string | null {
  if (s.halted === "protected") return "🔒 Stopped: only protected songs came up";
  if (s.halted === "errors") return "Stopped: several songs in a row couldn't be played";
  if (s.skipping) return `🔒 ${s.skipping.name} is protected, skipping (play it in iTunes)`;
  if (!s.current) return null;
  if (s.resume !== null) return `⏸ ${s.current.name} — ${s.current.artist}${s.resume > 0 ? `  (resume at ${formatTime(s.resume)})` : ""}`;
  const where = s.stale ? "next: from the current results" : `${s.pos + 1}/${s.songs.length}${s.shuffle ? ", shuffled" : ""}`;
  return `▶ ${s.current.name} — ${s.current.artist}  (${where})`;
}

export const IDLE_TEXT = "Click a song to play the current selection";
