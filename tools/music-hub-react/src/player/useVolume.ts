import { useCallback, useState } from "react";
import { clampVolume, parseSavedVolume } from "./volume";

const KEY = "ls_volume"; // the same key as the current page, so both remember one volume

function read(): { vol: number; muted: boolean } {
  try {
    return parseSavedVolume(localStorage.getItem(KEY));
  } catch {
    return parseSavedVolume(null); // storage can be blocked (private windows)
  }
}

/** The volume and the mute switch, remembered between visits. */
export function useVolume() {
  const [state, setState] = useState(read);

  const save = (next: { vol: number; muted: boolean }) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* not remembered: the page still works */
    }
    return next;
  };

  /** Moving the slider (or the wheel) also unmutes. */
  const setVol = useCallback((vol: number) => setState(() => save({ vol: clampVolume(vol), muted: false })), []);
  const toggleMute = useCallback(() => setState((s) => save({ ...s, muted: !s.muted })), []);
  const changeBy = useCallback((delta: number) => setState((s) => save({ vol: clampVolume(s.vol + delta), muted: false })), []);

  return { ...state, setVol, toggleMute, changeBy };
}
