// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fixtureLibrary } from "../data/fixture";
import { buildDataset } from "../data/load";
import type { Song } from "../data/types";
import { useAudioPlayer } from "./useAudioPlayer";

const songs = buildDataset(fixtureLibrary()).songs.slice(0, 4);
const volume = { vol: 80, muted: false };

// jsdom does not play media: the audio element's methods are stand-ins, and the test sends the element's events itself
let audio: HTMLAudioElement | null;
let played: string[];
beforeEach(() => {
  audio = null;
  played = [];
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function (this: HTMLMediaElement) {
    audio = this as HTMLAudioElement;
    played.push(decodeURIComponent(this.getAttribute("src") ?? ""));
    return Promise.resolve();
  });
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(function (this: HTMLMediaElement) {
    audio = this as HTMLAudioElement;
  });
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const setup = (rows: readonly Song[] = songs, vol = volume) => renderHook(({ r, v }) => useAudioPlayer(r, v), { initialProps: { r: rows, v: vol } });
const send = (type: string) => act(() => void audio!.dispatchEvent(new Event(type)));
const setTime = (el: HTMLAudioElement, currentTime: number, duration: number) => {
  Object.defineProperty(el, "currentTime", { value: currentTime, writable: true, configurable: true });
  Object.defineProperty(el, "duration", { value: duration, writable: true, configurable: true });
};

describe("starting a song", () => {
  it("loads it from the helper and plays it", () => {
    const { result } = setup();
    act(() => result.current.start(1));
    expect(result.current.queue.current).toBe(songs[1]);
    expect(played).toEqual([`/audio?p=${songs[1]!.path}`]);
    expect(result.current.text).toBe("▶ Take On Me — a-ha  (2/4)");
  });
  it("starts the list from the top when no song is clicked", () => {
    const { result } = setup();
    act(() => result.current.toggle()); // nothing playing: play starts the list
    expect(result.current.queue.current).toBe(songs[0]);
  });
  it("clicking the song that is playing starts it again", () => {
    const { result } = setup();
    act(() => result.current.start(2));
    act(() => result.current.start(2));
    expect(played).toHaveLength(2);
  });
  it("a protected purchase does not start; a notice says why, and goes away", () => {
    const rows = [songs[0]!, { ...songs[1]!, protected: true }, songs[2]!];
    const { result } = setup(rows);
    act(() => result.current.start(1));
    expect(result.current.queue.current).toBeNull();
    expect(played).toEqual([]);
    expect(result.current.text).toContain("a protected iTunes purchase, a browser can't play it");
    act(() => void vi.advanceTimersByTime(3100));
    expect(result.current.text).toBe("Click a song to play the current selection");
  });
});

describe("going on", () => {
  it("when a song ends, the next one plays", () => {
    const { result } = setup();
    act(() => result.current.start(0));
    send("ended");
    expect(result.current.queue.current).toBe(songs[1]);
    expect(played).toHaveLength(2);
  });
  it("a protected song in the way is skipped after a pause", () => {
    const rows = [songs[0]!, { ...songs[1]!, protected: true }, songs[2]!];
    const { result } = setup(rows);
    act(() => result.current.start(0));
    send("ended");
    expect(result.current.text).toBe("🔒 Take On Me is protected, skipping (play it in iTunes)");
    expect(result.current.queue.current).toBe(songs[0]);
    act(() => void vi.advanceTimersByTime(950));
    expect(result.current.queue.current).toBe(songs[2]);
  });
  it("a song the browser cannot load is reported and skipped", () => {
    const { result } = setup();
    act(() => result.current.start(0));
    send("error");
    expect(result.current.text).toBe("Can't play Spider Man Theme (skipping)");
    act(() => void vi.advanceTimersByTime(650));
    expect(result.current.queue.current).toBe(songs[1]);
  });
  it("gives up after several failures in a row, instead of going round and round", () => {
    const { result } = setup();
    act(() => result.current.start(0));
    for (let i = 0; i < 5; i++) {
      send("error");
      act(() => void vi.advanceTimersByTime(700));
    }
    expect(result.current.queue.halted).toBe("errors");
    expect(result.current.text).toBe("Stopped: several songs in a row couldn't be played");
  });
  it("a song that plays clears the failures", () => {
    const { result } = setup();
    act(() => result.current.start(0));
    send("error");
    send("playing");
    expect(result.current.queue.errs).toBe(0);
  });
});

describe("previous", () => {
  it("a few seconds into a song it goes back to the start of that song", () => {
    const { result } = setup();
    act(() => result.current.start(2));
    setTime(audio!, 12, 200);
    act(() => result.current.prev());
    expect((audio as HTMLAudioElement).currentTime).toBe(0);
    expect(result.current.queue.current).toBe(songs[2]);
  });
  it("near the start it goes to the song before", () => {
    const { result } = setup();
    act(() => result.current.start(2));
    setTime(audio!, 1, 200);
    act(() => result.current.prev());
    expect(result.current.queue.current).toBe(songs[1]);
  });
});

describe("pause, stop and the list changing", () => {
  it("toggle pauses a playing song and plays a paused one", () => {
    const { result } = setup();
    act(() => result.current.start(0));
    const pause = vi.mocked(HTMLMediaElement.prototype.pause);
    Object.defineProperty(audio!, "paused", { value: false, configurable: true });
    act(() => result.current.toggle());
    expect(pause).toHaveBeenCalled();
    Object.defineProperty(audio!, "paused", { value: true, configurable: true });
    const before = played.length;
    act(() => result.current.toggle());
    expect(played.length).toBe(before + 1);
  });
  it("the status follows the audio element", () => {
    const { result } = setup();
    act(() => result.current.start(0));
    send("play");
    expect(result.current.status.paused).toBe(false);
    setTime(audio!, 42, 180);
    send("timeupdate");
    expect(result.current.status).toMatchObject({ time: 42, duration: 180 });
    send("pause");
    expect(result.current.status.paused).toBe(true);
  });
  it("stop unloads the song and shows the idle text", () => {
    const { result } = setup();
    act(() => result.current.start(0));
    act(() => result.current.stop());
    expect(result.current.queue.current).toBeNull();
    expect(audio!.hasAttribute("src")).toBe(false);
    expect(result.current.text).toBe("Click a song to play the current selection");
    expect(result.current.status).toMatchObject({ paused: true, time: 0 });
  });
  it("when the list changes the song goes on, and the next one comes from the new list", () => {
    const { result, rerender } = setup();
    act(() => result.current.start(1));
    const newList = [songs[3]!, songs[1]!, songs[2]!];
    rerender({ r: newList, v: volume });
    act(() => result.current.markStale());
    expect(result.current.text).toBe("▶ Take On Me — a-ha  (next: from the current results)");
    send("ended");
    expect(result.current.queue.current).toBe(songs[2]); // after Take On Me in the new list
  });
});

describe("shuffle and seeking", () => {
  it("shuffle is remembered and shown in the line", () => {
    const { result } = setup();
    act(() => result.current.setShuffle(true));
    act(() => result.current.start(1));
    expect(result.current.text).toBe("▶ Take On Me — a-ha  (1/4, shuffled)");
  });
  it("seekTo jumps to a fraction of the song", () => {
    const { result } = setup();
    act(() => result.current.start(0));
    setTime(audio!, 0, 200);
    act(() => result.current.seekTo(0.25));
    expect((audio as HTMLAudioElement).currentTime).toBe(50);
  });
  it("skipBy moves forward or back and stays inside the song", () => {
    const { result } = setup();
    act(() => result.current.start(0));
    setTime(audio!, 100, 200);
    expect(result.current.skipBy(5)).toBe(105);
    expect(result.current.skipBy(-500)).toBe(0);
    expect(result.current.skipBy(9999)).toBe(200);
  });
  it("skipBy and seekTo do nothing before a song has loaded", () => {
    const { result } = setup();
    act(() => result.current.start(0));
    setTime(audio!, 0, NaN);
    expect(result.current.skipBy(5)).toBeNull();
  });
});

describe("volume", () => {
  it("is squared on its way to the audio, and mute silences it", () => {
    const { result, rerender } = setup(songs, { vol: 50, muted: false });
    act(() => result.current.start(0));
    expect(audio!.volume).toBe(0.25);
    rerender({ r: songs, v: { vol: 50, muted: true } });
    expect(audio!.volume).toBe(0);
    rerender({ r: songs, v: { vol: 100, muted: false } });
    expect(audio!.volume).toBe(1);
  });
});

describe("restoring the song of the last visit", () => {
  it("loads it but does not play, and says where it will resume", () => {
    const { result } = setup();
    act(() => result.current.restore(songs[1]!, 1, 83));
    expect(played).toEqual([]);
    expect(result.current.queue.current).toBe(songs[1]);
    expect(result.current.status.paused).toBe(true);
    expect(result.current.text).toBe(`⏸ ${songs[1]!.name} — ${songs[1]!.artist}  (resume at 1:23)`);
  });
  it("puts the song at its place once it knows its length (but not at the very end)", () => {
    const { result } = setup();
    let el: HTMLAudioElement | undefined;
    vi.spyOn(HTMLMediaElement.prototype, "preload", "set").mockImplementation(function (this: HTMLMediaElement) {
      el = this as HTMLAudioElement;
    });
    act(() => result.current.restore(songs[1]!, 1, 83));
    setTime(el!, 0, 200);
    el!.dispatchEvent(new Event("loadedmetadata"));
    expect(el!.currentTime).toBe(83);
    // a position at or past the end is ignored
    act(() => result.current.restore(songs[2]!, 2, 199.5));
    setTime(el!, 0, 200);
    el!.dispatchEvent(new Event("loadedmetadata"));
    expect(el!.currentTime).toBe(0);
  });
  it("pressing play plays it, and the waiting text goes away", () => {
    const { result } = setup();
    act(() => result.current.restore(songs[1]!, 1, 83));
    act(() => result.current.toggle());
    send("playing");
    expect(result.current.queue.resume).toBeNull();
    expect(result.current.text).toBe(`▶ ${songs[1]!.name} — ${songs[1]!.artist}  (2/4)`);
  });
  it("a song that will not load is forgotten without a fuss (no skipping, no notice)", () => {
    const { result } = setup();
    let el: HTMLAudioElement | undefined;
    vi.spyOn(HTMLMediaElement.prototype, "preload", "set").mockImplementation(function (this: HTMLMediaElement) {
      el = this as HTMLAudioElement;
    });
    act(() => result.current.restore(songs[1]!, 1, 83));
    act(() => void el!.dispatchEvent(new Event("error")));
    act(() => void vi.advanceTimersByTime(2000));
    expect(result.current.queue.current).toBeNull();
    expect(result.current.queue.errs).toBe(0);
    expect(result.current.text).toBe("Click a song to play the current selection");
    expect(played).toEqual([]);
  });
  it("starts with shuffle on when the last visit had it", () => {
    const { result } = renderHook(() => useAudioPlayer(songs, volume, true));
    expect(result.current.queue.shuffle).toBe(true);
  });
});
