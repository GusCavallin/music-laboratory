import { useEffect, useRef } from "react";

const PARKED = ["b", "m", "f"];

/**
 * The mouse Back and Forward buttons (and Alt+Left / Alt+Right) undo and redo the filter views, like the "← back" chip, instead of leaving the page.
 *
 * The page parks itself on the middle of three history entries (b, m, f). Back lands on b and Forward on f; the handler does the undo or redo and
 * steps back to m, so the buttons never leave the page and keep working. A reload keeps the entries, so they are only made once.
 *
 * `goBack` and `goForward` say whether there was anything to go to; if not, `say` tells the user.
 */
export function useHistoryButtons(goBack: () => boolean, goForward: () => boolean, say: (message: string) => void): void {
  const latest = useRef({ goBack, goForward, say });
  useEffect(() => {
    latest.current = { goBack, goForward, say };
  });

  useEffect(() => {
    if (!PARKED.includes((history.state as { hub?: string } | null)?.hub ?? "")) {
      history.replaceState({ hub: "b" }, "");
      history.pushState({ hub: "m" }, "");
      history.pushState({ hub: "f" }, "");
      history.back();
    }
    const onPop = (e: PopStateEvent) => {
      const hub = (e.state as { hub?: string } | null)?.hub;
      const { goBack, goForward, say } = latest.current;
      if (hub === "b") {
        if (!goBack()) say("Nothing to go back to");
        history.forward();
      } else if (hub === "f") {
        if (!goForward()) say("Nothing to go forward to");
        history.back();
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
}
