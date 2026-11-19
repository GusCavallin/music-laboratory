import { useEffect, useRef } from "react";
import { withPlaylists, worthShowing } from "./tips";

export const TIP_DELAY = 150; // ms

const HIDE_ON = ["mousedown", "wheel", "dragstart", "keydown", "scroll"];

interface Props {
  /** more lines for a tip, such as the playlists of the song under the pointer (empty or missing: nothing more) */
  extra?: (el: HTMLElement) => readonly string[];
}

/**
 * The tooltips of the page: any element with a `data-tip` shows its text in a small box a moment after the pointer arrives (the browser's own
 * `title` tooltip waits far longer). The box follows the pointer and goes away on a press, the wheel, a key, a scroll or when the pointer leaves.
 */
export function TipLayer({ extra }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const extraRef = useRef(extra);
  useEffect(() => {
    extraRef.current = extra;
  });

  useEffect(() => {
    const tip = box.current!;
    let timer: number | undefined;
    const hide = () => {
      window.clearTimeout(timer);
      tip.style.display = "none";
    };
    const place = (e: MouseEvent) => {
      const x = Math.min(e.clientX + 14, innerWidth - tip.offsetWidth - 8);
      const y = e.clientY + 20;
      tip.style.left = `${Math.max(4, x)}px`;
      tip.style.top = `${y + tip.offsetHeight > innerHeight ? Math.max(4, e.clientY - tip.offsetHeight - 12) : y}px`;
    };
    const over = (e: MouseEvent) => {
      hide();
      const el = (e.target as Element | null)?.closest?.<HTMLElement>("[data-tip]");
      if (!el) return;
      const more = extraRef.current?.(el) ?? [];
      if (!worthShowing(el, more.length > 0)) return;
      const text = withPlaylists(el.dataset.tip ?? "", more);
      timer = window.setTimeout(() => {
        tip.textContent = text;
        tip.style.display = "block";
        place(e);
      }, TIP_DELAY);
    };
    const move = (e: MouseEvent) => {
      if (tip.style.display === "block") place(e);
    };
    document.addEventListener("mouseover", over);
    document.addEventListener("mousemove", move);
    for (const ev of HIDE_ON) document.addEventListener(ev, hide, true);
    document.documentElement.addEventListener("mouseleave", hide);
    return () => {
      hide();
      document.removeEventListener("mouseover", over);
      document.removeEventListener("mousemove", move);
      for (const ev of HIDE_ON) document.removeEventListener(ev, hide, true);
      document.documentElement.removeEventListener("mouseleave", hide);
    };
  }, []);

  return <div id="tip" ref={box} role="tooltip" />;
}
