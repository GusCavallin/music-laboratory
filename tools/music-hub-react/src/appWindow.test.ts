import { describe, expect, it, vi } from "vitest";
import { growAppWindow, isAppWindow, markAppWindow, MIN_WINDOW_HEIGHT, MIN_WINDOW_WIDTH, type WindowHost } from "./appWindow";

/** A window host for a test: which media queries match, the screen, and the window's inner and outer size (outer = inner + 16 x 39 of frame). */
const host = (over: { modes?: string[]; fine?: boolean; screen?: [number, number]; inner?: [number, number]; resizeTo?: WindowHost["resizeTo"] } = {}) => {
  const { modes = ["standalone"], fine = true, screen = [1920, 1040], inner = [800, 500] } = over;
  const resizeTo = over.resizeTo ?? vi.fn();
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
  };
  return { h, resizeTo };
};

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
