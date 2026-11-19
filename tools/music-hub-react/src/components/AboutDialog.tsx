import { useEffect, useRef } from "react";

interface Props {
  open: boolean;
  /** from the VERSION file at the repo root (empty until the first release) */
  version: string;
  onClose: () => void;
}

/** The "ⓘ About" box. Esc, the Close button or a click outside it closes it. */
export function AboutDialog({ open, version, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) {
      if (typeof d.showModal === "function") d.showModal();
      else d.setAttribute("open", "");
    } else if (!open && d.open) {
      if (typeof d.close === "function") d.close();
      else d.removeAttribute("open");
    }
  }, [open]);

  return (
    <dialog
      id="about"
      ref={dialog}
      aria-labelledby="about_h"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialog.current) onClose(); // a click on the backdrop lands on the dialog element itself
      }}
    >
      <h2 id="about_h">Music Hub</h2>
      <p className="mut">{version ? `Version ${version}` : "Not released yet"}</p>
      <p>Search, explore and play your iTunes library, with Feel ratings and a map of how songs feel.</p>
      <p className="mut">
        It reads your iTunes library file and never changes it. The one exception is clicking stars, which sets that rating in iTunes (it needs the
        helper, <code>serve.bat</code>).
      </p>
      <p>Made by Gustavo Cavallin, with Claude (Anthropic).</p>
      <p>
        License:{" "}
        <a href="https://polyformproject.org/licenses/noncommercial/1.0.0/" target="_blank" rel="noopener noreferrer">PolyForm Noncommercial 1.0.0</a>:
        free for personal and other noncommercial use.
      </p>
      <p>
        Source:{" "}
        <a href="https://github.com/GusCavallin/music-laboratory" target="_blank" rel="noopener noreferrer">github.com/GusCavallin/music-laboratory</a>
        <br />
        Support: <a href="https://ko-fi.com/gustavocavallin" target="_blank" rel="noopener noreferrer">ko-fi.com/gustavocavallin</a>
      </p>
      <div className="x">
        <button type="button" onClick={onClose}>Close</button>
      </div>
    </dialog>
  );
}
