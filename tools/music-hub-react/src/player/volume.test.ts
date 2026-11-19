import { describe, expect, it } from "vitest";
import { WheelSteps, audioVolume, clampVolume, mmss, parseSavedVolume, volumeIcon } from "./volume";

describe("mmss", () => {
  it("minutes and two-digit seconds", () => {
    expect(mmss(0)).toBe("0:00");
    expect(mmss(5)).toBe("0:05");
    expect(mmss(227.9)).toBe("3:47");
    expect(mmss(3725)).toBe("62:05");
  });
  it("0:00 when nothing is loaded (the duration is not a number)", () => {
    expect(mmss(NaN)).toBe("0:00");
    expect(mmss(Infinity)).toBe("0:00");
  });
});

describe("volume", () => {
  it("the slider is squared, and mute is silence", () => {
    expect(audioVolume(100, false)).toBe(1);
    expect(audioVolume(50, false)).toBe(0.25);
    expect(audioVolume(0, false)).toBe(0);
    expect(audioVolume(80, true)).toBe(0);
  });
  it("the icon follows the level", () => {
    expect(volumeIcon(80, false)).toBe("🔊");
    expect(volumeIcon(30, false)).toBe("🔉");
    expect(volumeIcon(0, false)).toBe("🔇");
    expect(volumeIcon(80, true)).toBe("🔇");
  });
  it("stays between 0 and 100", () => {
    expect(clampVolume(120)).toBe(100);
    expect(clampVolume(-5)).toBe(0);
    expect(clampVolume(42.6)).toBe(43);
  });
  it("reads the remembered volume, and falls back to 80% for anything unusable", () => {
    expect(parseSavedVolume('{"vol":35,"muted":true}')).toEqual({ vol: 35, muted: true });
    expect(parseSavedVolume('{"vol":35}')).toEqual({ vol: 35, muted: false });
    for (const bad of [null, "", "not json", '{"vol":"loud"}', '{"vol":150}', '{"vol":-1}', "[]"]) {
      expect(parseSavedVolume(bad)).toEqual({ vol: 80, muted: false });
    }
  });
});

describe("WheelSteps", () => {
  const make = () => {
    let t = 1000;
    const w = new WheelSteps(() => t);
    return { w, at: (ms: number) => (t = ms) };
  };
  it("one notch of a mouse wheel (100) is one step; up is positive", () => {
    const { w } = make();
    expect(w.step(-100)).toBe(1);
    expect(w.step(100)).toBe(-1);
  });
  it("a touchpad's small movements add up to a step", () => {
    const { w, at } = make();
    expect(w.step(-30)).toBe(0);
    at(1100);
    expect(w.step(-30)).toBe(0);
    at(1200);
    expect(w.step(-50)).toBe(1); // 110 in all
    at(1250);
    expect(w.step(-95)).toBe(1); // 10 left over + 95
  });
  it("forgets what was added up after a pause", () => {
    const { w, at } = make();
    w.step(-90);
    at(2000);
    expect(w.step(-30)).toBe(0);
  });
  it("a line-based wheel (deltaMode 1) counts 40 per line", () => {
    const { w } = make();
    expect(w.step(-3, 1)).toBe(1); // 120
  });
  it("never returns a negative zero", () => {
    const { w } = make();
    expect(Object.is(w.step(10), 0)).toBe(true);
  });
});
