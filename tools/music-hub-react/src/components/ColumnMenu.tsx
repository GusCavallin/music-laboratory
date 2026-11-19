import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Column } from "../columns";

interface Props {
  /** every column of this set, in the order they are shown */
  columns: readonly Column[];
  hidden: ReadonlySet<string>;
  /** where the pointer was (the menu opens there, kept inside the window) */
  at: { x: number; y: number };
  onToggle: (key: string, shown: boolean) => void;
  onResetOrder: () => void;
  onClose: () => void;
}

/** The menu that opens on a right-click of a column header: tick the columns to show, or put them back in their usual order. */
export function ColumnMenu({ columns, hidden, at, onToggle, onResetOrder, onClose }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: at.x, top: at.y });

  useLayoutEffect(() => {
    const m = box.current;
    if (!m) return;
    setPos({
      left: Math.max(4, Math.min(at.x, innerWidth - m.offsetWidth - 8)),
      top: Math.max(4, Math.min(at.y, innerHeight - m.offsetHeight - 8)),
    });
  }, [at.x, at.y]);

  useEffect(() => {
    const away = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) onClose();
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    window.addEventListener("blur", onClose);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
      window.removeEventListener("blur", onClose);
    };
  }, [onClose]);

  return (
    <div id="colbox" ref={box} role="menu" aria-label="Columns" style={pos}>
      <div className="mh">Columns <small>(drag headers to reorder)</small></div>
      {columns.map((c) => (
        <label key={c.key}>
          <input type="checkbox" checked={!hidden.has(c.key)} onChange={(e) => onToggle(c.key, e.target.checked)} /> {c.label}
        </label>
      ))}
      <button type="button" onClick={onResetOrder}>↺ Reset order</button>
    </div>
  );
}
