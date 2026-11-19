import { useEffect, useRef, useState } from "react";
import { TAB_LABEL, type Preset } from "../presets/presets";

interface Props {
  presets: readonly Preset[];
  /** the current view saved under this name; false if the name was empty */
  onSave: (name: string) => boolean;
  onApply: (index: number) => void;
  /** replace a preset with the current view */
  onReplace: (index: number) => void;
  onRename: (index: number) => void;
  onDelete: (index: number) => void;
}

/** The "★ Presets" button and its menu: save the current view under a name, apply a saved one, replace, rename or delete it. */
export function PresetsControl({ presets, onSave, onApply, onReplace, onRename, onDelete }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    field.current?.focus();
    const away = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!menu.current?.contains(t) && !button.current?.contains(t)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const save = () => {
    if (onSave(name)) setName("");
  };

  const rect = open ? button.current?.getBoundingClientRect() : undefined;
  const style = rect ? { top: rect.bottom + 6, left: Math.max(8, Math.min(rect.left, innerWidth - 400 - 8)) } : undefined;

  return (
    <>
      <button ref={button} type="button" aria-haspopup="menu" aria-expanded={open} data-tip="Saved views: tab, filters, sliders, 3D box and sort" onClick={() => setOpen((o) => !o)}>
        ★ Presets ▾
      </button>
      {open && (
        <div className="presetmenu" ref={menu} style={style} role="menu">
          <div className="pm-save">
            <input
              ref={field}
              value={name}
              maxLength={60}
              autoComplete="off"
              aria-label="Name for the current view"
              placeholder="Name for the current view"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  save();
                }
              }}
            />
            <button type="button" data-tip="Save the current tab, filters, sliders, 3D box and sort. Using an existing name updates that preset." onClick={save}>
              Save
            </button>
          </div>
          {presets.length ? (
            presets.map((p, i) => (
              <div className="pm-row" key={p.name}>
                <button
                  type="button"
                  className="nm"
                  data-tip="Apply (← back undoes it)"
                  onClick={() => {
                    setOpen(false);
                    onApply(i);
                  }}
                >
                  {p.name} <small>{TAB_LABEL[p.state.tab ?? ""] ?? ""}</small>
                </button>
                <button type="button" aria-label={`Replace ${p.name} with the current view`} data-tip="Replace this preset with the current view" onClick={() => onReplace(i)}>⟳</button>
                <button type="button" aria-label={`Rename ${p.name}`} data-tip="Rename" onClick={() => onRename(i)}>✎</button>
                <button type="button" aria-label={`Delete ${p.name}`} data-tip="Delete" onClick={() => onDelete(i)}>✕</button>
              </div>
            ))
          ) : (
            <div className="pm-empty">No presets yet. Set up a view, name it above, and press Save.</div>
          )}
        </div>
      )}
    </>
  );
}
