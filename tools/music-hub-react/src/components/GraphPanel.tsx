import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { Song } from "../data/types";
import { drawFlat, draw3D, drawHint, pickDot, plot2D, readPalette, splitDots, type Dot } from "../feel/draw";
import { plain, selectionStats, signed, type GraphModel, type StatLine } from "../feel/model";
import { CAM0, rotate, zoomBy, type Camera } from "../feel/project";
import { useElementSize, useThemeVersion } from "../hooks/useElementSize";

interface Props {
  model: GraphModel;
  /** every iTunes song (the dots the model can draw come from these) */
  songs: readonly Song[];
  /** the songs in the list: bright dots, and the ones the statistics are about */
  rows: readonly Song[];
  /** the Cube / Flat choice exists only on the Feel Axes tab */
  showViewChoice: boolean;
  view: "cube" | "flat";
  onView: (view: "cube" | "flat") => void;
  /** the song that is playing: a ring is drawn around its dot */
  nowSong?: Song | null;
  /** a click on a dot: the song to play */
  onDotClick?: (song: Song) => void;
}

/** The graph beside the list: a line, a quadrant or the 3D cube (or the three flat plots), the statistics of the selection, and a legend. */
export function GraphPanel({ model, songs, rows, showViewChoice, view, onView, nowSong = null, onDotClick }: Props) {
  const stage = useRef<HTMLDivElement>(null);
  const main = useRef<HTMLCanvasElement>(null);
  const flat = useRef<(HTMLCanvasElement | null)[]>([null, null, null]);
  const size = useElementSize(stage);
  const themeVersion = useThemeVersion();
  const [cam, setCam] = useState<Camera>(CAM0);
  const dots = useRef<Dot[]>([]);
  const flatDots = useRef<Dot[][]>([[], [], []]);
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);

  const lit = useMemo(() => new Set(rows.map((s) => s.ix)), [rows]);
  const stats = useMemo(() => selectionStats(rows, model.stats()), [rows, model]);
  const rot3 = model.n >= 3;
  const showFlat = showViewChoice && view === "flat";

  useEffect(() => {
    const P = readPalette();
    const { bright, dim } = splitDots(songs, model, lit);
    if (showFlat) {
      flatDots.current = drawFlat(flat.current, model, bright, dim, P, nowSong);
      return;
    }
    const cv = main.current;
    if (!cv) return;
    if (model.n >= 3) dots.current = draw3D(cv, model, bright, dim, cam, P, nowSong);
    else if (model.n > 0) dots.current = plot2D(cv, model, bright, dim, 0, model.n > 1 ? 1 : null, P, nowSong);
    else {
      dots.current = [];
      drawHint(cv, P);
    }
  }, [model, songs, lit, cam, size.w, size.h, showFlat, themeVersion, nowSong]);

  // the wheel zooms the cube; React's own wheel handler is passive and could not stop the page from scrolling
  useEffect(() => {
    const cv = main.current;
    if (!cv || !rot3) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setCam((c) => zoomBy(c, e.deltaY));
    };
    cv.addEventListener("wheel", onWheel, { passive: false });
    return () => cv.removeEventListener("wheel", onWheel);
  }, [rot3, showFlat]);

  const hover = (cv: HTMLCanvasElement, list: readonly Dot[], clientX: number, clientY: number) => {
    const box = cv.getBoundingClientRect();
    const song = pickDot(list, clientX - box.left, clientY - box.top);
    cv.title = song ? model.dotText(song) : "";
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    drag.current = { x: e.clientX, y: e.clientY, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const d = drag.current;
    if (!d) return hover(e.currentTarget, dots.current, e.clientX, e.clientY);
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
    if (!d.moved || !rot3) return;
    setCam((c) => rotate(c, dx, dy));
    d.x = e.clientX;
    d.y = e.clientY;
  };
  const onPointerUp = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const d = drag.current;
    drag.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    if (d && !d.moved) pickAndClick(e.currentTarget, dots.current, e.clientX, e.clientY); // a click, not a drag
  };
  const pickAndClick = (cv: HTMLCanvasElement, list: readonly Dot[], clientX: number, clientY: number) => {
    const box = cv.getBoundingClientRect();
    const song = pickDot(list, clientX - box.left, clientY - box.top);
    if (song) onDotClick?.(song);
  };

  return (
    <section className="cubebox" aria-label="Graph">
      <div className="cubebar">
        {showViewChoice && (
          <>
            <button type="button" className={view === "cube" ? "on" : undefined} onClick={() => onView("cube")}>Cube</button>
            <button type="button" className={view === "flat" ? "on" : undefined} onClick={() => onView("flat")}>Flat</button>
          </>
        )}
        {rot3 && <button type="button" data-tip="Reset the camera (or double-click the cube)" onClick={() => setCam(CAM0)}>⟲ View</button>}
        <span className="cubecount" aria-live="polite">{rows.length.toLocaleString()} songs lit</span>
      </div>
      <div className="cubestage" ref={stage}>
        <canvas
          ref={main}
          hidden={showFlat}
          style={{ cursor: rot3 ? undefined : "default" }}
          aria-label="Songs plotted by how they feel"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={(e) => (e.currentTarget.title = "")}
          onDoubleClick={() => rot3 && setCam(CAM0)}
        />
        <div className="flatwrap" hidden={!showFlat}>
          {[0, 1, 2].map((k) => (
            <canvas
              key={k}
              ref={(el) => { flat.current[k] = el; }}
              aria-label={`Flat plot ${k + 1} of 3`}
              onPointerMove={(e) => hover(e.currentTarget, flatDots.current[k] ?? [], e.clientX, e.clientY)}
              onPointerLeave={(e) => (e.currentTarget.title = "")}
              onClick={(e) => pickAndClick(e.currentTarget, flatDots.current[k] ?? [], e.clientX, e.clientY)}
            />
          ))}
        </div>
      </div>
      <StatsBlock lines={stats} count={rows.length} extra={model.extra} />
      <div className="cubesep" />
      <Legend model={model} />
    </section>
  );
}

/** For each plotted scale: the mean of the songs in the list, and how far it is from the mean of all rated songs. */
function StatsBlock({ lines, count, extra }: { lines: readonly StatLine[]; count: number; extra: readonly string[] }) {
  const more = extra.length ? ` · also filtering, not plotted: ${extra.join(", ")}` : "";
  if (!count) return <div className="cubestats"><div className="sth">No songs in the selection.{more}</div></div>;
  return (
    <div className="cubestats">
      <div className="sth">
        The {count.toLocaleString()} songs in the list: mean, and distance from the mean of all rated songs{more}
      </div>
      <div className="sg">
        {lines.map((r) => {
          const first = r.name.split(" ")[0];
          if (!r.n || r.mean == null || r.d == null) return <span className="sc" key={r.name}><b>{first}</b> no scores</span>;
          const pct = Math.round(Math.min(1, Math.abs(r.z) / 2.5) * 55);
          const style = pct < 3 ? undefined : { background: `color-mix(in srgb, var(${r.z > 0 ? "--warm" : "--cool"}) ${pct}%, transparent)` };
          const tip =
            `${r.name}: mean ${plain(r.mean, 2)} over ${r.n.toLocaleString()} songs in the list · all rated songs ${plain(r.m, 2)} · ` +
            `${signed(r.d, 2)} (${signed(r.z, 2)} stdev)`;
          return (
            <span className="sc" key={r.name} data-tip={tip} style={style}>
              <b>{first}</b> {plain(r.mean, r.dp > 1 ? r.dp : 1)} <span>{signed(r.d, r.dp)}</span> <small>{signed(r.z, 1)} sd</small>
            </span>
          );
        })}
      </div>
    </div>
  );
}

function Legend({ model }: { model: GraphModel }) {
  return (
    <div className="cubelegend">
      {model.colorName ? (
        <>
          <span>Dot color = {model.colorName.toLowerCase()}</span>
          <span className="lg" />
          <span>
            cooler = below the average song · warmer = above{model.kind === "cube" ? " · hollow = no score (instrumental)" : ""} · faded = outside your filters
          </span>
        </>
      ) : (
        <span>One dot color until a 4th slider is narrowed (it then colors the dots) · faded = outside your filters</span>
      )}
      {model.kind === "feel" && model.n > 0 && <span>Scores are whole numbers, so dots are nudged slightly apart</span>}
      <span>{model.n >= 3 ? "Drag to rotate · wheel to zoom · double-click resets · click a dot to play it" : model.n ? "Click a dot to play it" : ""}</span>
    </div>
  );
}
