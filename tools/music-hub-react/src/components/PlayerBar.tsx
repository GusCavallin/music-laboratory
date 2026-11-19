import { useEffect, useRef } from "react";
import { WheelSteps, mmss, volumeIcon } from "../player/volume";

interface Props {
  /** the "now playing" line (or the idle text, or a short notice) */
  text: string;
  /** the path of the playing song, shown on hover */
  path?: string;
  paused: boolean;
  time: number;
  duration: number;
  shuffle: boolean;
  vol: number;
  muted: boolean;
  onPrev: () => void;
  onStop: () => void;
  onToggle: () => void;
  onNext: () => void;
  onShuffle: () => void;
  /** a click on the "now playing" text: show the song in the list */
  onNow: () => void;
  /** a place in the song, as a fraction */
  onSeek: (fraction: number) => void;
  /** the wheel over the progress bar: skip this many seconds; returns the new position, for the hint */
  onSkip: (seconds: number) => number | null;
  onVolume: (vol: number) => void;
  onVolumeBy: (delta: number) => void;
  onMute: () => void;
  /** a short hint (the position after a wheel skip, the volume after a wheel change) */
  onHint: (text: string) => void;
}

/** A wheel listener that can stop the page from scrolling (React's own wheel handler is passive). */
function useWheel(ref: React.RefObject<HTMLElement | null>, handler: (steps: number) => void) {
  const steps = useRef(new WheelSteps());
  const latest = useRef(handler);
  useEffect(() => {
    latest.current = handler;
  });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const n = steps.current.step(e.deltaY, e.deltaMode);
      if (n) latest.current(n);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [ref]);
}

/** Previous, stop, play/pause, next and shuffle; the song that is playing; the progress and the volume. */
export function PlayerBar(p: Props) {
  const seekBox = useRef<HTMLDivElement>(null);
  const volBox = useRef<HTMLDivElement>(null);

  useWheel(seekBox, (n) => {
    const at = p.onSkip(5 * n);
    if (at !== null) p.onHint(`${mmss(at)} / ${mmss(p.duration)}`);
  });
  useWheel(volBox, (n) => {
    p.onVolumeBy(5 * n);
    p.onHint(`Volume ${Math.max(0, Math.min(100, p.vol + 5 * n))}%`);
  });

  const progress = p.duration ? (p.time / p.duration) * 1000 : 0;
  return (
    <div className="player">
      <button type="button" aria-label="Previous" data-tip="Previous" onClick={p.onPrev}>⏮</button>
      <button type="button" aria-label="Stop" data-tip="Stop" onClick={p.onStop}>⏹</button>
      <button type="button" aria-label={p.paused ? "Play" : "Pause"} data-tip="Play / Pause" onClick={p.onToggle}>{p.paused ? "▶" : "⏸"}</button>
      <button type="button" aria-label="Next" data-tip="Next" onClick={p.onNext}>⏭</button>
      <button type="button" className={p.shuffle ? "on" : undefined} aria-pressed={p.shuffle} aria-label="Shuffle" data-tip="Shuffle" onClick={p.onShuffle}>🔀</button>
      <button type="button" className="pnow" data-tip={p.path} onClick={p.onNow}>{p.text}</button>
      <div className="zone" ref={seekBox}>
        <input
          type="range" min={0} max={1000} value={progress} aria-label="Position in the song"
          data-tip="Drag to seek; mouse wheel skips 5 s"
          onChange={(e) => p.onSeek(Number(e.target.value) / 1000)}
        />
        <span className="ptime">{mmss(p.time)} / {mmss(p.duration)}</span>
      </div>
      <div className="zone" ref={volBox}>
        <button type="button" aria-label={p.muted ? "Unmute" : "Mute"} data-tip={p.muted ? "Unmute" : "Mute"} onClick={p.onMute}>{volumeIcon(p.vol, p.muted)}</button>
        <input
          type="range" min={0} max={100} value={p.vol} aria-label="Volume"
          data-tip={`Volume ${p.vol}% (mouse wheel adjusts)`}
          onChange={(e) => p.onVolume(Number(e.target.value))}
        />
      </div>
    </div>
  );
}
