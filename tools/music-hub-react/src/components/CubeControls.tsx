import type { Dispatch } from "react";
import type { Cube } from "../feel/cube";
import type { Action, CubeUi } from "../state/uiState";
import { DualRange } from "./DualRange";

interface Props {
  /** null: no axes data (tools/emotions/axes.py has not been run) */
  cube: Cube | null;
  ui: CubeUi;
  dispatch: Dispatch<Action>;
}

/** The Feel Axes controls: the box you size in the cube, with a slider for each of the three axes and one for maturity. */
export function CubeControls({ cube, ui, dispatch }: Props) {
  if (!cube) {
    return (
      <div className="row">
        <span className="hint">No Feel Axes data yet. Build it with <code>py -3 tools\emotions\axes.py</code>, then refresh the data.</span>
      </div>
    );
  }
  const bounds = cube.lo.map((lo, i): [number, number] => [lo, cube.hi[i]!]);
  const ranges = ui.ranges ?? bounds;
  return (
    <div className="row cuberow">
      {cube.axes.map((axis, i) => {
        const [lo, hi] = ranges[i]!;
        return (
          <div className="fbox" key={axis.name} title={`${axis.low}  ←  →  ${axis.high}`}>
            <b>
              {axis.name} <small>{lo.toFixed(1)} – {hi.toFixed(1)}</small>
            </b>
            <DualRange
              min={cube.lo[i]!} max={cube.hi[i]!} step={0.1} lo={lo} hi={hi} label={axis.name}
              onChange={(which, value) => dispatch({ type: "cubeRange", index: i as 0 | 1 | 2, which, value, bounds })}
            />
          </div>
        );
      })}
      <div className="fbox" title="Maturity is the dot color. Instrumentals have no maturity score, so narrowing this slider leaves them out">
        <b>
          Maturity <small>{ui.maturity[0]} – {ui.maturity[1]}</small>
        </b>
        <DualRange
          min={0} max={10} step={1} lo={ui.maturity[0]} hi={ui.maturity[1]} label="Maturity"
          onChange={(which, value) => dispatch({ type: "cubeRange", index: "m", which, value, bounds })}
        />
      </div>
      <button type="button" title="The box grows back to every song" onClick={() => dispatch({ type: "cubeReset" })}>Reset box</button>
    </div>
  );
}
