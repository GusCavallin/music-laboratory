// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fixtureLibrary } from "../data/fixture";
import { buildDataset } from "../data/load";
import { buildCube, type Cube } from "../feel/cube";
import { initialCubeUi, type CubeUi } from "../state/uiState";
import { CubeControls } from "./CubeControls";

afterEach(cleanup);
const ds = buildDataset(fixtureLibrary());
const cube = buildCube(ds.songs, ds.axes)!;
const setup = (ui: CubeUi = initialCubeUi(), c: Cube | null = cube) => {
  const dispatch = vi.fn();
  render(<CubeControls cube={c} ui={ui} dispatch={dispatch} />);
  return dispatch;
};

describe("CubeControls", () => {
  it("a slider for each axis and one for maturity, showing the whole cube at first", () => {
    setup();
    expect(screen.getAllByRole("slider")).toHaveLength(8);
    expect(screen.getByText("Calm").parentElement!.textContent).toContain(`${cube.lo[0]!.toFixed(1)} – ${cube.hi[0]!.toFixed(1)}`);
    expect(screen.getByText("Maturity").parentElement!.textContent).toContain("0 – 10");
  });
  it("shows the box that was set", () => {
    setup({ ...initialCubeUi(), ranges: [[0.5, 1], [-1, 0], [0, 2]], maturity: [4, 9] });
    expect(screen.getByText("Calm").parentElement!.textContent).toContain("0.5 – 1.0");
    expect(screen.getByText("Maturity").parentElement!.textContent).toContain("4 – 9");
  });
  it("moving an axis dispatches it with the whole-cube bounds (the first move starts from them)", () => {
    const dispatch = setup();
    fireEvent.change(screen.getByLabelText("Ease minimum"), { target: { value: "-0.5" } });
    const action = dispatch.mock.calls[0]![0];
    expect(action).toMatchObject({ type: "cubeRange", index: 1, which: "lo", value: -0.5 });
    expect(action.bounds).toHaveLength(3);
    expect(action.bounds[1]).toEqual([cube.lo[1], cube.hi[1]]);
  });
  it("maturity dispatches as 'm'", () => {
    const dispatch = setup();
    fireEvent.change(screen.getByLabelText("Maturity maximum"), { target: { value: "8" } });
    expect(dispatch.mock.calls[0]![0]).toMatchObject({ type: "cubeRange", index: "m", which: "hi", value: 8 });
  });
  it("Reset box asks to reset", async () => {
    const dispatch = setup();
    await userEvent.click(screen.getByRole("button", { name: "Reset box" }));
    expect(dispatch).toHaveBeenCalledWith({ type: "cubeReset" });
  });
  it("without axes data it says how to build them", () => {
    setup(initialCubeUi(), null);
    expect(screen.getByText(/No Feel Axes data yet/)).toBeTruthy();
    expect(screen.queryAllByRole("slider")).toHaveLength(0);
  });
});
