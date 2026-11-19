import { useCallback, useEffect, useState } from "react";
import { buildDataset, parseLibraryScript } from "../data/load";
import type { Dataset } from "../data/types";

export type LibraryState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; dataset: Dataset };

/**
 * Loads data.js (the helper serves it at /data.js; the dev server serves it from the music-hub-core folder) and builds the dataset.
 * `reload` fetches it again without clearing what is on screen, and returns the new data (null if it could not be loaded).
 */
export function useLibrary(url = "/data.js"): { state: LibraryState; reload: () => Promise<Dataset | null> } {
  const [state, setState] = useState<LibraryState>({ status: "loading" });

  const load = useCallback(async (): Promise<Dataset | null> => {
    try {
      const response = await fetch(`${url}?${Date.now()}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`.trim());
      const dataset = buildDataset(parseLibraryScript(await response.text()));
      setState({ status: "ready", dataset });
      return dataset;
    } catch (e) {
      setState((old) => (old.status === "ready" ? old : { status: "error", message: e instanceof Error ? e.message : String(e) }));
      return null;
    }
  }, [url]);

  useEffect(() => {
    void load();
  }, [load]);

  return { state, reload: load };
}
