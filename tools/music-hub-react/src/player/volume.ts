/** 227 seconds become "3:47"; anything that is not a finite number (no song loaded) is "0:00". */
export const mmss = (t: number): string =>
  Number.isFinite(t) ? `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}` : "0:00";

/** The slider is squared before it reaches the audio element: low levels are finer, which feels natural. */
export const audioVolume = (vol: number, muted: boolean): number => (muted ? 0 : (vol / 100) ** 2);

export const volumeIcon = (vol: number, muted: boolean): string => (muted || vol === 0 ? "🔇" : vol < 50 ? "🔉" : "🔊");

export const clampVolume = (vol: number): number => Math.max(0, Math.min(100, Math.round(vol)));

export interface SavedVolume {
  vol: number;
  muted: boolean;
}

/** Reads the remembered volume; anything unusable gives the default (80%, not muted). */
export function parseSavedVolume(text: string | null): SavedVolume {
  try {
    const v = JSON.parse(text ?? "null") as { vol?: unknown; muted?: unknown } | null;
    if (v && typeof v.vol === "number" && v.vol >= 0 && v.vol <= 100) return { vol: v.vol, muted: !!v.muted };
  } catch {
    /* fall through to the default */
  }
  return { vol: 80, muted: false };
}

/**
 * Turns mouse-wheel movement into whole steps: a touchpad's small deltas add up to a step (100 units), and the sum is forgotten after a short
 * pause. Scrolling up is a positive step. `now` is injectable for tests.
 */
export class WheelSteps {
  private acc = 0;
  private last = 0;
  constructor(private readonly now: () => number = () => performance.now()) {}

  step(deltaY: number, deltaMode = 0): number {
    const t = this.now();
    if (t - this.last > 400) this.acc = 0;
    this.last = t;
    this.acc += deltaMode ? deltaY * 40 : deltaY;
    const n = Math.trunc(this.acc / 100);
    this.acc -= n * 100;
    return -n || 0;
  }
}
