/**
 * The installed app window: a web app manifest cannot set a window size, so when the app window opens on a desktop that is narrower than MIN_WINDOW_WIDTH
 * (the width that keeps the Raw Feel options beside the sliders) or shorter than MIN_WINDOW_HEIGHT, it grows to that, once. Dragging it smaller
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
