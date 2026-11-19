import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { audioUrl } from "../api/helper";
import type { Song } from "../data/types";
import { useNotice } from "../hooks/useNotice";
import { IDLE_TEXT, MAX_ERRORS, idleQueue, nowText, queueReducer } from "./queue";
import { audioVolume } from "./volume";

export interface AudioStatus {
  paused: boolean;
  /** seconds */
  time: number;
  /** seconds; NaN until a song has loaded */
  duration: number;
}

/**
 * Plays the songs of the list. The queue (queue.ts) decides which song is next; this hook is the part that touches the browser: one audio element, its
 * events, the media keys, and the volume. `rows` is the list on screen, `volume` what the volume slider says.
 */
export function useAudioPlayer(rows: readonly Song[], volume: { vol: number; muted: boolean }, initialShuffle = false) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  if (!audioRef.current && typeof Audio !== "undefined") audioRef.current = new Audio();
  const audio = audioRef.current;

  const [queue, dispatch] = useReducer(queueReducer, initialShuffle, (shuffle: boolean) => ({ ...idleQueue(), shuffle }));
  const [status, setStatus] = useState<AudioStatus>({ paused: true, time: 0, duration: NaN });
  const [notice, showNotice] = useNotice();

  // the latest values, for the audio element's event handlers (which are set once)
  const queueRef = useRef(queue);
  const rowsRef = useRef(rows);
  useEffect(() => {
    queueRef.current = queue;
    rowsRef.current = rows;
  });

  const next = useCallback(() => dispatch({ type: "next", rows: rowsRef.current }), []);

  // a song was started: load it and play
  useEffect(() => {
    if (!audio) return;
    const song = queue.current;
    if (!song) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      setStatus({ paused: true, time: 0, duration: NaN });
      if ("mediaSession" in navigator) navigator.mediaSession.metadata = null;
      return;
    }
    audio.src = audioUrl(song.path);
    const resume = queueRef.current.resume;
    if (resume !== null) {
      // the song of the last visit: load it, put it where it was, and wait for the play button (a page must not start playing by itself)
      audio.preload = "metadata";
      audio.addEventListener("loadedmetadata", () => {
        if (resume > 0 && resume < audio.duration - 1) audio.currentTime = resume;
      }, { once: true });
      setStatus({ paused: true, time: resume, duration: NaN });
      return;
    }
    audio.preload = "auto";
    void audio.play().catch(() => {}); // the browser may refuse before the first click; the play button then starts it
    if ("mediaSession" in navigator && typeof MediaMetadata !== "undefined") {
      navigator.mediaSession.metadata = new MediaMetadata({ title: song.name, artist: song.artist, album: song.album });
    }
    // a new song starts when `serial` changes (also for the same song clicked again), not when the song object does
  }, [audio, queue.serial]);

  // the audio element's own events
  useEffect(() => {
    if (!audio) return;
    const onPlay = () => setStatus((s) => ({ ...s, paused: false }));
    const onPause = () => setStatus((s) => ({ ...s, paused: true }));
    const onPlaying = () => dispatch({ type: "playing" });
    const onTime = () => setStatus((s) => ({ ...s, time: audio.currentTime, duration: audio.duration }));
    const onError = () => {
      const q = queueRef.current;
      if (!q.current) return;
      if (q.resume !== null) return dispatch({ type: "stop" }); // the song of the last visit would not load: forget it quietly
      dispatch({ type: "error" });
      if (q.errs + 1 < MAX_ERRORS) {
        showNotice(`Can't play ${q.current.name} (skipping)`, 1500);
        window.setTimeout(next, 600);
      }
    };
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("playing", onPlaying);
    audio.addEventListener("ended", next);
    audio.addEventListener("error", onError);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("durationchange", onTime);
    return () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("playing", onPlaying);
      audio.removeEventListener("ended", next);
      audio.removeEventListener("error", onError);
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("durationchange", onTime);
    };
  }, [audio, next, showNotice]);

  // a protected purchase came up: say so, and go on to the next song after a pause
  useEffect(() => {
    if (!queue.skipping) return;
    const id = window.setTimeout(() => dispatch({ type: "goto", pos: queueRef.current.pos + 1 }), 900);
    return () => window.clearTimeout(id);
  }, [queue.skipping, queue.pos]);

  // playback gave up
  useEffect(() => {
    if (queue.halted) audio?.pause();
  }, [audio, queue.halted]);

  useEffect(() => {
    if (audio) audio.volume = audioVolume(volume.vol, volume.muted);
  }, [audio, volume.vol, volume.muted]);

  const start = useCallback(
    (index: number | null) => {
      const song = index === null ? null : rowsRef.current[index];
      if (song?.protected) {
        showNotice(`🔒 ${song.name}: a protected iTunes purchase, a browser can't play it. Play it in iTunes.`, 3000);
        return;
      }
      dispatch({ type: "start", rows: rowsRef.current, index });
    },
    [showNotice],
  );

  /** Brings the song of the last visit back, paused at `t` seconds (`index`: its place in the list, or -1). */
  const restore = useCallback((song: Song, index: number, t: number) => dispatch({ type: "restore", song, rows: rowsRef.current, index, t }), []);

  const toggle = useCallback(() => {
    if (!audio) return;
    if (!queueRef.current.current) return start(null);
    if (audio.paused) void audio.play().catch(() => {});
    else audio.pause();
  }, [audio, start]);

  const prev = useCallback(() => {
    if (audio && queueRef.current.current && audio.currentTime > 3) {
      audio.currentTime = 0; // a few seconds in: back to the start of this song first
      return;
    }
    dispatch({ type: "prev", rows: rowsRef.current });
  }, [audio]);

  const stop = useCallback(() => dispatch({ type: "stop" }), []);
  const pause = useCallback(() => audio?.pause(), [audio]);
  const setShuffle = useCallback((value: boolean) => dispatch({ type: "shuffle", value }), []);
  const markStale = useCallback(() => dispatch({ type: "stale" }), []);

  /** Jumps to a place in the song, as a fraction (0 to 1) of its length. */
  const seekTo = useCallback(
    (fraction: number) => {
      if (audio && audio.duration) audio.currentTime = fraction * audio.duration;
    },
    [audio],
  );
  /** Skips forward or back by a number of seconds, staying inside the song. */
  const skipBy = useCallback(
    (seconds: number): number | null => {
      if (!audio || !audio.duration) return null;
      audio.currentTime = Math.max(0, Math.min(audio.duration, audio.currentTime + seconds));
      return audio.currentTime;
    },
    [audio],
  );

  // the media keys and the notification controls
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    const handlers: [MediaSessionAction, () => void][] = [["play", toggle], ["pause", toggle], ["stop", stop], ["nexttrack", next], ["previoustrack", prev]];
    for (const [action, handler] of handlers) navigator.mediaSession.setActionHandler(action, handler);
    return () => {
      for (const [action] of handlers) navigator.mediaSession.setActionHandler(action, null);
    };
  }, [toggle, stop, next, prev]);

  return {
    queue, status,
    // a short notice shows for a moment, but never over the message that playback has stopped
    text: (queue.halted ? nowText(queue) : (notice ?? nowText(queue))) ?? IDLE_TEXT,
    notice: showNotice,
    start, restore, toggle, next, prev, stop, pause, setShuffle, markStale, seekTo, skipBy,
  };
}
