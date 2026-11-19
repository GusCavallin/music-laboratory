import { describe, expect, it } from "vitest";
import { fixtureLibrary } from "../data/fixture";
import { buildDataset } from "../data/load";
import type { Song } from "../data/types";
import { MAX_ERRORS, idleQueue, nowText, playOrder, queueReducer, type QueueAction, type QueueState } from "./queue";

const songs = buildDataset(fixtureLibrary()).songs; // eight songs, ix 0..7
const first = (n: number) => songs.slice(0, n);
const lock = (s: Song): Song => ({ ...s, protected: true });
const run = (actions: QueueAction[], from: QueueState = idleQueue()) => actions.reduce(queueReducer, from);
/** a "random" source that gives the same numbers every time */
const seq = (...values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length]!;
};
const ixs = (s: QueueState) => s.order.map((i) => s.songs[i]!.ix);

describe("playOrder", () => {
  it("not shuffled: the songs in order", () => {
    expect(playOrder(4, false, 2, Math.random)).toEqual([0, 1, 2, 3]);
  });
  it("shuffled: every song once, with the first one first", () => {
    for (let n = 1; n < 12; n++) {
      const order = playOrder(n, true, n - 1, Math.random);
      expect(order[0]).toBe(n - 1);
      expect([...order].sort((a, b) => a - b)).toEqual(Array.from({ length: n }, (_, i) => i));
    }
  });
  it("shuffled without a first song: still every song once", () => {
    expect([...playOrder(6, true, -1, Math.random)].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5]);
  });
  it("is the same for the same random numbers", () => {
    expect(playOrder(6, true, -1, seq(0.1, 0.7, 0.3, 0.9, 0.5))).toEqual(playOrder(6, true, -1, seq(0.1, 0.7, 0.3, 0.9, 0.5)));
  });
});

describe("start", () => {
  it("at the top of the list, or at a clicked song", () => {
    const top = run([{ type: "start", rows: first(4), index: null }]);
    expect(top.current).toBe(songs[0]);
    expect([top.pos, top.stale, top.songs.length]).toEqual([0, false, 4]);
    const clicked = run([{ type: "start", rows: first(4), index: 2 }]);
    expect(clicked.current).toBe(songs[2]);
    expect(clicked.pos).toBe(2);
  });
  it("shuffled with nothing clicked: starts at a random song; a clicked song plays first", () => {
    const s = run([{ type: "shuffle", value: true }, { type: "start", rows: first(8), index: null, rng: seq(0.5) }]);
    expect(s.current).toBe(songs[4]); // floor(.5 * 8)
    const c = run([{ type: "shuffle", value: true }, { type: "start", rows: first(8), index: 3 }]);
    expect(c.current).toBe(songs[3]);
    expect(c.pos).toBe(0);
  });
  it("a protected purchase that was clicked does not start (the caller says why)", () => {
    const rows = [songs[0]!, lock(songs[1]!), songs[2]!];
    const s = run([{ type: "start", rows, index: 1 }]);
    expect(s).toEqual(idleQueue());
  });
  it("nothing to play when the list is empty", () => {
    expect(run([{ type: "start", rows: [], index: null }])).toEqual(idleQueue());
  });
  it("starting the song that is already playing starts it again (the serial changes)", () => {
    const once = run([{ type: "start", rows: first(4), index: 1 }]);
    const again = queueReducer(once, { type: "start", rows: first(4), index: 1 });
    expect(again.current).toBe(once.current);
    expect(again.serial).toBeGreaterThan(once.serial);
  });
  it("copies the list, so a later change to it cannot change the queue", () => {
    const rows = first(3);
    const s = run([{ type: "start", rows, index: null }]);
    rows.length = 0;
    expect(s.songs).toHaveLength(3);
  });
});

describe("next and previous", () => {
  const playing = () => run([{ type: "start", rows: first(4), index: 1 }]);
  it("go one song on or back, and wrap round at the ends", () => {
    expect(queueReducer(playing(), { type: "next", rows: first(4) }).current).toBe(songs[2]);
    expect(queueReducer(playing(), { type: "prev", rows: first(4) }).current).toBe(songs[0]);
    const atEnd = run([{ type: "start", rows: first(4), index: 3 }, { type: "next", rows: first(4) }]);
    expect(atEnd.current).toBe(songs[0]);
    const atStart = run([{ type: "start", rows: first(4), index: 0 }, { type: "prev", rows: first(4) }]);
    expect(atStart.current).toBe(songs[3]);
  });
  it("with nothing playing, next starts the list", () => {
    expect(run([{ type: "next", rows: first(4) }]).current).toBe(songs[0]);
    expect(run([{ type: "prev", rows: first(4) }]).current).toBe(songs[0]);
  });
  it("with nothing playing and nothing in the list, nothing happens", () => {
    expect(run([{ type: "next", rows: [] }])).toEqual(idleQueue());
  });
});

describe("a changed list", () => {
  const playing = () => run([{ type: "start", rows: first(4), index: 1 }]);
  it("marks the queue stale without interrupting the song", () => {
    const s = queueReducer(playing(), { type: "stale" });
    expect(s.stale).toBe(true);
    expect(s.current).toBe(songs[1]);
  });
  it("nothing is stale before anything has played", () => {
    expect(queueReducer(idleQueue(), { type: "stale" }).stale).toBe(false);
  });
  it("the next song then comes from the new list, after the playing song if it is still there", () => {
    const newList = [songs[5]!, songs[1]!, songs[6]!];
    const s = run([{ type: "stale" }, { type: "next", rows: newList }], playing());
    expect(s.current).toBe(songs[6]);
    expect(s.stale).toBe(false);
    expect(s.songs.map((x) => x.ix)).toEqual([5, 1, 6]);
  });
  it("and from its top if the playing song is no longer in the list", () => {
    const s = run([{ type: "stale" }, { type: "next", rows: [songs[5]!, songs[6]!] }], playing());
    expect(s.current).toBe(songs[5]);
  });
  it("previous also uses the new list", () => {
    const s = run([{ type: "stale" }, { type: "prev", rows: [songs[5]!, songs[1]!, songs[6]!] }], playing());
    expect(s.current).toBe(songs[5]);
  });
});

describe("shuffle", () => {
  it("turning it on reorders the rest and keeps the playing song first", () => {
    const s = run([{ type: "start", rows: first(8), index: 2 }, { type: "shuffle", value: true, rng: seq(0.3, 0.6, 0.1) }]);
    expect(s.shuffle).toBe(true);
    expect(s.current).toBe(songs[2]);
    expect(s.pos).toBe(0);
    expect(ixs(s)[0]).toBe(2);
    expect([...ixs(s)].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });
  it("turning it off goes back to list order from the playing song", () => {
    const s = run([{ type: "shuffle", value: true }, { type: "start", rows: first(6), index: 4 }, { type: "shuffle", value: false }]);
    expect(ixs(s)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(s.pos).toBe(4);
  });
  it("is remembered with nothing playing, and does not reorder a stale queue", () => {
    expect(queueReducer(idleQueue(), { type: "shuffle", value: true }).shuffle).toBe(true);
    const stale = run([{ type: "start", rows: first(4), index: 0 }, { type: "stale" }]);
    expect(queueReducer(stale, { type: "shuffle", value: true }).order).toEqual(stale.order);
  });
});

describe("protected songs", () => {
  const rows = [songs[0]!, lock(songs[1]!), lock(songs[2]!), songs[3]!];
  it("landing on one is noted, and the song stays what it was", () => {
    const s = run([{ type: "start", rows, index: 0 }, { type: "next", rows }]);
    expect(s.skipping).toBe(rows[1]);
    expect(s.current).toBe(songs[0]);
    expect(s.pos).toBe(1);
    expect(nowText(s)).toBe("🔒 Take On Me is protected, skipping (play it in iTunes)");
  });
  it("going on past it plays the next playable song", () => {
    const s = run([{ type: "start", rows, index: 0 }, { type: "next", rows }, { type: "goto", pos: 2 }, { type: "goto", pos: 3 }]);
    expect(s.current).toBe(songs[3]);
    expect(s.skipping).toBeNull();
    expect(s.errs).toBe(2);
  });
  it("gives up when only protected songs come up", () => {
    const all = [lock(songs[0]!), lock(songs[1]!)];
    let s = run([{ type: "shuffle", value: false }]);
    s = { ...s, songs: all, order: [0, 1], pos: 0 };
    for (let i = 0; i < MAX_ERRORS; i++) s = queueReducer(s, { type: "goto", pos: s.pos + 1 });
    expect(s.halted).toBe("protected");
    expect(s.errs).toBe(0);
    expect(nowText(s)).toBe("🔒 Stopped: only protected songs came up");
  });
});

describe("audio errors", () => {
  it("each one is counted; the fifth in a row halts playback", () => {
    let s = run([{ type: "start", rows: first(4), index: 0 }]);
    for (let i = 1; i < MAX_ERRORS; i++) {
      s = queueReducer(s, { type: "error" });
      expect(s.halted).toBeNull();
    }
    s = queueReducer(s, { type: "error" });
    expect(s.halted).toBe("errors");
    expect(nowText(s)).toBe("Stopped: several songs in a row couldn't be played");
  });
  it("a song that plays clears the count", () => {
    const s = run([{ type: "start", rows: first(4), index: 0 }, { type: "error" }, { type: "error" }, { type: "playing" }]);
    expect(s.errs).toBe(0);
  });
});

describe("stop", () => {
  it("empties the queue and forgets the song, but keeps the shuffle choice", () => {
    const s = run([{ type: "shuffle", value: true }, { type: "start", rows: first(4), index: 1 }, { type: "stop" }]);
    expect({ ...s, serial: 0 }).toEqual({ ...idleQueue(), shuffle: true });
  });
  it("counts as a change, so the audio notices", () => {
    const playing = run([{ type: "start", rows: first(4), index: 1 }]);
    expect(queueReducer(playing, { type: "stop" }).serial).toBeGreaterThan(playing.serial);
  });
});

describe("nowText", () => {
  it("is null when nothing plays (the page shows its idle text)", () => {
    expect(nowText(idleQueue())).toBeNull();
  });
  it("shows the place in the queue, and says when it is shuffled", () => {
    const s = run([{ type: "start", rows: first(4), index: 1 }]);
    expect(nowText(s)).toBe("▶ Take On Me — a-ha  (2/4)");
    const shuffled = run([{ type: "shuffle", value: true }, { type: "start", rows: first(4), index: 1 }]);
    expect(nowText(shuffled)).toBe("▶ Take On Me — a-ha  (1/4, shuffled)");
  });
  it("says where the next song will come from once the list has changed", () => {
    const s = run([{ type: "start", rows: first(4), index: 0 }, { type: "stale" }]);
    expect(nowText(s)).toBe("▶ Spider Man Theme — The Webs  (next: from the current results)");
  });
});
