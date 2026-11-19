import { useCallback, useEffect, useRef, useState } from "react";

/** A short message that replaces the "now playing" line for a while ("a protected purchase can't play here"), then goes. */
export function useNotice(): [string | null, (text: string, ms?: number) => void] {
  const [text, setText] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const show = useCallback((message: string, ms = 3000) => {
    setText(message);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setText(null), ms);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  return [text, show];
}
