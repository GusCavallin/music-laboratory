import { useCallback, useEffect, useState } from "react";
import { ping } from "../api/helper";

/**
 * Is the Python helper there? null while we are finding out.
 * - `recheck` asks again; `ensure` is "is it there?", asking again only if the last answer was no (start serve.bat, click a song, and it plays: no reload).
 * - Coming back to this window while it is missing asks again, so starting serve.bat in another window is enough.
 * - While it is there, a /presence stream is held open: the helper stops itself when the last page that connected has gone, so a page that
 *   uses it must say it is alive (the current page does the same).
 */
export function useHelper(): { available: boolean | null; recheck: () => Promise<boolean>; ensure: () => Promise<boolean> } {
  const [available, setAvailable] = useState<boolean | null>(null);

  const recheck = useCallback(async () => {
    const up = await ping();
    setAvailable(up);
    return up;
  }, []);

  const ensure = useCallback(async () => (available === true ? true : recheck()), [available, recheck]);

  useEffect(() => {
    void recheck();
  }, [recheck]);

  useEffect(() => {
    if (available !== false) return;
    const again = () => {
      if (document.visibilityState !== "hidden") void recheck();
    };
    window.addEventListener("focus", again);
    document.addEventListener("visibilitychange", again);
    return () => {
      window.removeEventListener("focus", again);
      document.removeEventListener("visibilitychange", again);
    };
  }, [available, recheck]);

  useEffect(() => {
    if (!available || typeof EventSource === "undefined") return;
    const stream = new EventSource("/presence");
    return () => stream.close();
  }, [available]);

  return { available, recheck, ensure };
}
