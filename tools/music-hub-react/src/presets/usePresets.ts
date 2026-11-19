import { useCallback, useEffect, useState } from "react";
import { loadPresets, savePresetsToHelper } from "../api/helper";
import { isPresetList, type Preset } from "./presets";

const KEY = "ls_presets"; // the same key as the current page

function readLocal(): Preset[] {
  try {
    const list: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return isPresetList(list) ? list : [];
  } catch {
    return [];
  }
}

/**
 * The saved views. The helper keeps them in presets.json (so they survive a port change or cleared browser data, and the current page sees the
 * same ones); without it they live in this browser's storage. `helper` is whether the helper answered (null while that is unknown).
 */
export function usePresets(helper: boolean | null, onError: (message: string) => void) {
  const [presets, setPresets] = useState<Preset[]>([]);

  useEffect(() => {
    if (helper === null) return;
    let cancelled = false;
    void (async () => {
      const fromHelper = helper ? await loadPresets() : null;
      if (cancelled) return;
      setPresets(isPresetList(fromHelper) ? fromHelper : readLocal());
    })();
    return () => {
      cancelled = true;
    };
  }, [helper]);

  const save = useCallback(
    (list: Preset[]) => {
      setPresets(list);
      if (helper) {
        void savePresetsToHelper(list).then((ok) => ok || onError("Couldn't save the presets"));
        return;
      }
      try {
        localStorage.setItem(KEY, JSON.stringify(list));
      } catch {
        onError("Couldn't save the presets");
      }
    },
    [helper, onError],
  );

  return { presets, save };
}
