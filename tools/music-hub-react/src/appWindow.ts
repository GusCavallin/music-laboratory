/**
 * The installed app window: a web app manifest cannot set a window size, so the page does it. It keeps the size the window had when you last resized it and
 * opens at that size (restoreAppWindow); the first time, with no kept size, an app window on a desktop that is narrower than MIN_WINDOW_WIDTH
 * (the width that keeps the Raw Feel options beside the sliders) or shorter than MIN_WINDOW_HEIGHT grows to that, once. Dragging it smaller
 * afterwards is left alone. A normal browser tab, a phone (no fine pointer) and a screen smaller than the size are untouched. Same numbers and rules as
 * the current page (tools/music-hub/index.html).
 */
export const MIN_WINDOW_WIDTH = 1090;
export const MIN_WINDOW_HEIGHT = 600;

const APP_MODES = ["standalone", "minimal-ui", "window-controls-overlay"];

/** The parts of `window` this needs, so a test can hand in its own. */
export interface WindowHost {
  matchMedia(query: string): { matches: boolean };
  screen: { availWidth: number; availHeight: number };
  innerWidth: number;
  innerHeight: number;
  outerWidth: number;
  outerHeight: number;
  resizeTo(width: number, height: number): void;
  addEventListener(type: "resize", listener: () => void): void;
  removeEventListener(type: "resize", listener: () => void): void;
  localStorage: Pick<Storage, "getItem" | "setItem">;
}

/** Where the size of the window is kept between visits (the current page uses the same key, but its own origin, so each page keeps its own). */
export const WINDOW_SIZE_KEY = "ls_window";
const FLOOR_WIDTH = 400; // a size smaller than this is not a window somebody meant (a minimized window reports 0)
const FLOOR_HEIGHT = 300;

export interface WindowSize {
  width: number;
  height: number;
}

/** The size (outer, frame included) the window had when it was last resized, or null when none was kept or it is unusable. */
export function loadWindowSize(host: Pick<WindowHost, "localStorage"> = window): WindowSize | null {
  try {
    const v = JSON.parse(host.localStorage.getItem(WINDOW_SIZE_KEY) ?? "null");
    if (v && Number.isFinite(v.width) && Number.isFinite(v.height) && v.width >= FLOOR_WIDTH && v.height >= FLOOR_HEIGHT) {
      return { width: Math.round(v.width), height: Math.round(v.height) };
    }
  } catch {
    /* storage blocked or the text damaged: no kept size */
  }
  return null;
}

function saveWindowSize(size: WindowSize, host: Pick<WindowHost, "localStorage">): void {
  if (size.width < FLOOR_WIDTH || size.height < FLOOR_HEIGHT) return;
  try {
    host.localStorage.setItem(WINDOW_SIZE_KEY, JSON.stringify(size));
  } catch {
    /* not remembered */
  }
}

/** Whether this is an installed app window on a desktop (not a browser tab, not a phone). */
export function isAppWindow(host: Pick<WindowHost, "matchMedia"> = window): boolean {
  return APP_MODES.some((mode) => host.matchMedia(`(display-mode: ${mode})`).matches) && host.matchMedia("(pointer: fine)").matches;
}

/**
 * Marks the page as an app window with the class "app" on the root element. index.css then keeps the page at least MIN_WINDOW_WIDTH wide (a narrower window
 * scrolls sideways) and uses the wide layouts whatever the window width is: the page's own width breakpoints look at the window, not at the page.
 */
export function markAppWindow(root: { classList: { add(c: string): void } } = document.documentElement, host: Pick<WindowHost, "matchMedia"> = window): boolean {
  if (!isAppWindow(host)) return false;
  root.classList.add("app");
  return true;
}

/** Makes an app window at least the minimum size. Returns the size it asked for, or null when it left the window alone. */
export function growAppWindow(host: WindowHost = window): { width: number; height: number } | null {
  if (!isAppWindow(host)) return null;
  const growW = Math.min(MIN_WINDOW_WIDTH, host.screen.availWidth) - host.innerWidth;
  const growH = Math.min(MIN_WINDOW_HEIGHT, host.screen.availHeight) - host.innerHeight;
  if (growW <= 0 && growH <= 0) return null;
  const size = { width: host.outerWidth + Math.max(growW, 0), height: host.outerHeight + Math.max(growH, 0) };
  try {
    host.resizeTo(size.width, size.height);
  } catch {
    return null; // the browser refused: the window stays as it is
  }
  return size;
}

/**
 * Opens an app window at the size it had when it was last closed (kept by `rememberAppWindow`), never bigger than the screen. With no kept size yet it
 * grows to the minimum, as `growAppWindow` does. Returns the size it asked for, or null when it left the window alone.
 */
export function restoreAppWindow(host: WindowHost = window): WindowSize | null {
  if (!isAppWindow(host)) return null;
  const saved = loadWindowSize(host);
  if (!saved) return growAppWindow(host);
  const size = { width: Math.min(saved.width, host.screen.availWidth), height: Math.min(saved.height, host.screen.availHeight) };
  if (size.width === host.outerWidth && size.height === host.outerHeight) return null;
  try {
    host.resizeTo(size.width, size.height);
  } catch {
    return null;
  }
  return size;
}

/**
 * Keeps the size of an app window when it is resized (a moment after the dragging stops), for `restoreAppWindow` to use the next time. Returns a function that
 * stops it, or null when this is not an app window.
 */
export function rememberAppWindow(host: WindowHost = window, delayMs = 500): (() => void) | null {
  if (!isAppWindow(host)) return null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const onResize = () => {
    clearTimeout(timer);
    timer = setTimeout(() => saveWindowSize({ width: host.outerWidth, height: host.outerHeight }, host), delayMs);
  };
  host.addEventListener("resize", onResize);
  return () => {
    clearTimeout(timer);
    host.removeEventListener("resize", onResize);
  };
}
