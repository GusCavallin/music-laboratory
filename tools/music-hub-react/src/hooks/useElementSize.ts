import { useEffect, useState, type RefObject } from "react";

/** The size of an element, kept up to date as it changes (the graph is redrawn when its stage grows or shrinks). */
export function useElementSize(ref: RefObject<HTMLElement | null>): { w: number; h: number } {
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const read = () => setSize((old) => {
      const w = Math.round(el.clientWidth);
      const h = Math.round(el.clientHeight);
      return old.w === w && old.h === h ? old : { w, h };
    });
    read();
    const observer = new ResizeObserver(read);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return size;
}

/** A number that goes up each time the system switches between the light and dark theme, so canvas drawings can be redone in the new colors. */
export function useThemeVersion(): number {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (typeof matchMedia === "undefined") return;
    const query = matchMedia("(prefers-color-scheme: dark)");
    const bump = () => setVersion((v) => v + 1);
    query.addEventListener("change", bump);
    return () => query.removeEventListener("change", bump);
  }, []);
  return version;
}
