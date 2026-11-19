import type { Dispatch } from "react";
import { FEEL_SCALES, type ConfidenceChoice } from "../data/feel";
import type { FeelState } from "../feel/feelState";
import { PAIRS, pairTip } from "../feel/pairs";
import type { Action } from "../state/uiState";
import { DualRange } from "./DualRange";

interface Props {
  feel: FeelState;
  dispatch: Dispatch<Action>;
}

/** The Raw Feel controls: ten min/max sliders in five linked pairs, and the options after them. */
export function FeelPanel({ feel, dispatch }: Props) {
  const slider = (index: number) => {
    const scale = FEEL_SCALES[index]!;
    const [lo, hi] = feel.ranges[index] ?? [0, 10];
    return (
      <div className="fbox" title={scale.tip}>
        <b>
          {scale.label} <small>{lo}–{hi}</small>
        </b>
        <DualRange min={0} max={10} step={1} lo={lo} hi={hi} label={scale.label} onChange={(which, value) => dispatch({ type: "feelRange", index, which, value })} />
      </div>
    );
  };

  return (
    <div className="row feelrow">
      <div className="fsl">
        {PAIRS.map((p) => {
          const on = feel.linked.includes(p.name);
          return (
            <div className="fpair" key={p.name}>
              {slider(p.a)}
              <button
                type="button"
                className={["flk", p.weak ? "weak" : "", on ? "on" : ""].filter(Boolean).join(" ")}
                aria-pressed={on}
                title={pairTip(p)}
                onClick={() => dispatch({ type: "feelLink", pair: p.name })}
              >
                🔗 {p.name}
              </button>
              {slider(p.b)}
            </div>
          );
        })}
      </div>
      <div className="fopts">
        <button type="button" title="All scales back to 0–10" onClick={() => dispatch({ type: "feelReset" })}>Reset sliders</button>
        <label className="fo" title="Plot the songs: the first four scales you narrow become the graph (a line, a quadrant, a cube, then a fourth color). The score columns are hidden while it is on.">
          <input type="checkbox" checked={feel.graph} onChange={(e) => dispatch({ type: "feelGraph", value: e.target.checked })} /> Show graph
        </label>
        <label className="fo" title="How sure the rater was when rating the song: show only the songs rated with that confidence (Low = the ones to take with a grain of salt)">
          Confidence{" "}
          <select value={feel.confidence} onChange={(e) => dispatch({ type: "feelConfidence", value: e.target.value as ConfidenceChoice })}>
            <option value="all">All</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </label>
        <label className="fo">
          Color{" "}
          <select
            title="vs. mean: cool = below the average song, warm = above (all rated songs, capped at ±2.5 stdev). Raw: darker = higher score."
            value={feel.color}
            onChange={(e) => dispatch({ type: "feelColor", value: e.target.value as "dev" | "raw" })}
          >
            <option value="dev">vs. the mean</option>
            <option value="raw">raw score</option>
          </select>
        </label>
      </div>
    </div>
  );
}
