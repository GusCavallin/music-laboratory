import { afterEach, describe, expect, it, vi } from "vitest";
import {
  growAppWindow, isAppWindow, loadWindowSize, markAppWindow, MIN_WINDOW_HEIGHT, MIN_WINDOW_WIDTH, rememberAppWindow, restoreAppWindow, WINDOW_SIZE_KEY,
  type WindowHost,
} from "./appWindow";

/** A window host for a test: which media queries match, the screen, the window's inner and outer size (outer = inner + 16 x 39 of frame), a storage and the resize listeners. */
const host = (over: { modes?: string[]; fine?: boolean; screen?: [number, number]; inner?: [number, number]; resizeTo?: WindowHost["resizeTo"]; kept?: string } = {}) => {
  const { modes = ["standalone"], fine = true, screen = [1920, 1040], inner = [800, 500] } = over;
  const resizeTo = over.resizeTo ?? vi.fn();
  const data: Record<string, string> = over.kept === undefined ? {} : { [WINDOW_SIZE_KEY]: over.kept };
  const listeners = new Set<() => void>();
  const h: WindowHost = {
    matchMedia: (q: string) => ({
      matches: q === "(pointer: fine)" ? fine : modes.some((m) => q === `(display-mode: ${m})`),
    }),
    screen: { availWidth: screen[0], availHeight: screen[1] },
    innerWidth: inner[0],
    innerHeight: inner[1],
    outerWidth: inner[0] + 16,
    outerHeight: inner[1] + 39,
    resizeTo,
    addEventListener: (_t, l) => void listeners.add(l),
    removeEventListener: (_t, l) => void listeners.delete(l),
    localStorage: { getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v) },
  };
  return { h, resizeTo, data, fire: () => listeners.forEach((l) => l()), listeners };
};
afterEach(() => vi.useRealTimers());

describe("isAppWindow and markAppWindow", () => {
  const root = () => {
    const classes = new Set<string>();
    return { classes, classList: { add: (c: string) => void classes.add(c) } };
  };
  it("an installed app window on a desktop is one, in any app display mode", () => {
    for (const mode of ["standalone", "minimal-ui", "window-controls-overlay"]) expect(isAppWindow(host({ modes: [mode] }).h), mode).toBe(true);
  });
  it("a browser tab, a fullscreen page and a phone are not", () => {
    expect(isAppWindow(host({ modes: [] }).h)).toBe(false);
    expect(isAppWindow(host({ modes: ["fullscreen", "browser"] }).h)).toBe(false);
    expect(isAppWindow(host({ fine: false }).h)).toBe(false);
  });
  it("marks the root element with the class app only for an app window", () => {
    const a = root();
    expect(markAppWindow(a, host().h)).toBe(true);
    expect([...a.classes]).toEqual(["app"]);
    const b = root();
    expect(markAppWindow(b, host({ modes: [] }).h)).toBe(false);
    expect(b.classes.size).toBe(0);
  });
});

describe("growAppWindow", () => {
  it("the numbers are the current page's", () => {
    expect([MIN_WINDOW_WIDTH, MIN_WINDOW_HEIGHT]).toEqual([1090, 600]);
  });
  it("grows a small app window to the minimum, keeping the frame around it", () => {
    const { h, resizeTo } = host({ inner: [800, 500] });
    expect(growAppWindow(h)).toEqual({ width: 816 + 290, height: 539 + 100 });
    expect(resizeTo).toHaveBeenCalledWith(1106, 639); // inner 1090 x 600
  });
  it("grows only the side that is too small", () => {
    const { h, resizeTo } = host({ inner: [1300, 500] });
    growAppWindow(h);
    expect(resizeTo).toHaveBeenCalledWith(1316, 639);
    const b = host({ inner: [800, 900] });
    growAppWindow(b.h);
    expect(b.resizeTo).toHaveBeenCalledWith(1106, 939);
  });
  it("leaves a window that is big enough alone, and one that is exactly the minimum", () => {
    const a = host({ inner: [1400, 800] });
    expect(growAppWindow(a.h)).toBeNull();
    expect(a.resizeTo).not.toHaveBeenCalled();
    const b = host({ inner: [1090, 600] });
    expect(growAppWindow(b.h)).toBeNull();
  });
  it("never asks for more than the screen has", () => {
    const { h, resizeTo } = host({ screen: [1000, 560], inner: [700, 400] });
    growAppWindow(h);
    expect(resizeTo).toHaveBeenCalledWith(716 + 300, 439 + 160); // inner 1000 x 560, not 1090 x 600
  });
  it("does nothing in a normal browser tab", () => {
    const { h, resizeTo } = host({ modes: [] });
    expect(growAppWindow(h)).toBeNull();
    expect(resizeTo).not.toHaveBeenCalled();
  });
  it("counts the other app display modes too", () => {
    for (const mode of ["standalone", "minimal-ui", "window-controls-overlay"]) {
      const { h, resizeTo } = host({ modes: [mode] });
      expect(growAppWindow(h), mode).not.toBeNull();
      expect(resizeTo).toHaveBeenCalledTimes(1);
    }
    expect(growAppWindow(host({ modes: ["fullscreen", "browser"] }).h)).toBeNull();
  });
  it("leaves a phone or tablet (no fine pointer) alone", () => {
    const { h, resizeTo } = host({ fine: false });
    expect(growAppWindow(h)).toBeNull();
    expect(resizeTo).not.toHaveBeenCalled();
  });
  it("a browser that refuses to resize is not an error", () => {
    const { h } = host({
      resizeTo: () => {
        throw new Error("not allowed");
      },
    });
    expect(growAppWindow(h)).toBeNull();
  });
});

describe("restoreAppWindow", () => {
  it("opens at the size the window had last time, not at the minimum", () => {
    const { h, resizeTo } = host({ kept: JSON.stringify({ width: 1500, height: 900 }) });
    expect(restoreAppWindow(h)).toEqual({ width: 1500, height: 900 });
    expect(resizeTo).toHaveBeenCalledWith(1500, 900);
  });
  it("honours a kept size smaller than the minimum (the page scrolls sideways in it)", () => {
    const { h, resizeTo } = host({ kept: JSON.stringify({ width: 900, height: 550 }) });
    restoreAppWindow(h);
    expect(resizeTo).toHaveBeenCalledWith(900, 550);
  });
  it("with no kept size, grows to the minimum as before", () => {
    const { h, resizeTo } = host({ inner: [800, 500] });
    expect(restoreAppWindow(h)).toEqual({ width: 1106, height: 639 });
    expect(resizeTo).toHaveBeenCalledWith(1106, 639);
  });
  it("never asks for more than the screen has (a smaller screen than last time)", () => {
    const { h, resizeTo } = host({ screen: [1366, 728], kept: JSON.stringify({ width: 1900, height: 1000 }) });
    restoreAppWindow(h);
    expect(resizeTo).toHaveBeenCalledWith(1366, 728);
  });
  it("leaves the window alone when it already has the kept size", () => {
    const { h, resizeTo } = host({ inner: [1484, 861], kept: JSON.stringify({ width: 1500, height: 900 }) });
    expect(restoreAppWindow(h)).toBeNull();
    expect(resizeTo).not.toHaveBeenCalled();
  });
  it("ignores a kept size that is damaged or too small to be meant", () => {
    for (const kept of ["not json", "null", JSON.stringify({ width: 0, height: 0 }), JSON.stringify({ width: "wide", height: 900 }), JSON.stringify({ width: 200, height: 100 })]) {
      const { h } = host({ kept });
      expect(loadWindowSize(h), kept).toBeNull();
    }
  });
  it("does nothing in a normal browser tab, and a browser that refuses is not an error", () => {
    const tab = host({ modes: [], kept: JSON.stringify({ width: 1500, height: 900 }) });
    expect(restoreAppWindow(tab.h)).toBeNull();
    expect(tab.resizeTo).not.toHaveBeenCalled();
    const refusing = host({ kept: JSON.stringify({ width: 1500, height: 900 }), resizeTo: () => { throw new Error("not allowed"); } });
    expect(restoreAppWindow(refusing.h)).toBeNull();
  });
});

describe("rememberAppWindow", () => {
  it("keeps the outer size a moment after the resizing stops, and only the last one", () => {
    vi.useFakeTimers();
    const w = host({ inner: [1300, 700] });
    rememberAppWindow(w.h, 500);
    w.fire();
    vi.advanceTimersByTime(200);
    w.fire(); // still dragging
    vi.advanceTimersByTime(499);
    expect(w.data[WINDOW_SIZE_KEY]).toBeUndefined();
    vi.advanceTimersByTime(1);
    expect(JSON.parse(w.data[WINDOW_SIZE_KEY]!)).toEqual({ width: 1316, height: 739 });
  });
  it("does not keep a minimized or tiny window", () => {
    vi.useFakeTimers();
    const w = host({ inner: [0, 0] });
    rememberAppWindow(w.h, 10);
    w.fire();
    vi.advanceTimersByTime(20);
    expect(w.data[WINDOW_SIZE_KEY]).toBeUndefined();
  });
  it("does nothing in a normal browser tab, and can be stopped", () => {
    const tab = host({ modes: [] });
    expect(rememberAppWindow(tab.h)).toBeNull();
    expect(tab.listeners.size).toBe(0);
    const w = host();
    const stop = rememberAppWindow(w.h)!;
    expect(w.listeners.size).toBe(1);
    stop();
    expect(w.listeners.size).toBe(0);
  });
  it("what it keeps is what restoreAppWindow opens at next time", () => {
    vi.useFakeTimers();
    const first = host({ inner: [1400, 800] });
    rememberAppWindow(first.h, 10);
    first.fire();
    vi.advanceTimersByTime(20);
    const next = host({ inner: [800, 500], kept: first.data[WINDOW_SIZE_KEY] });
    restoreAppWindow(next.h);
    expect(next.resizeTo).toHaveBeenCalledWith(1416, 839);
  });
});
