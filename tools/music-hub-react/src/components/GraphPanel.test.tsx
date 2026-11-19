// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { FEEL_SCALES, fullFeelRanges } from "../data/feel";
import { fixtureLibrary } from "../data/fixture";
import { buildDataset } from "../data/load";
import { buildCube, fullBox } from "../feel/cube";
import { cubeModel, feelModel } from "../feel/model";
import { GraphPanel } from "./GraphPanel";

// jsdom cannot draw: a canvas has no context, and the drawing code then does nothing. What is checked here is everything around the canvas.
beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = (() => null) as never;
});
afterEach(cleanup);

const ds = buildDataset(fixtureLibrary());
const cube = buildCube(ds.songs, ds.axes)!;
const rated = ds.songs.filter((s) => s.feel);
const idx = (key: string) => FEEL_SCALES.findIndex((s) => s.key === key);

const setupCube = (over: Partial<Parameters<typeof GraphPanel>[0]> = {}) => {
  const onView = vi.fn();
  render(<GraphPanel model={cubeModel(cube, fullBox(cube), ds.feelStats)} songs={ds.songs} rows={rated} showViewChoice view="cube" onView={onView} {...over} />);
  return onView;
};

describe("GraphPanel on Feel Axes", () => {
  it("says how many songs are lit", () => {
    setupCube();
    expect(screen.getByText("4 songs lit")).toBeTruthy();
  });
  it("Cube and Flat buttons, and a click on Flat asks for it", async () => {
    const onView = setupCube();
    expect(screen.getByRole("button", { name: "Cube" }).className).toBe("on");
    await userEvent.click(screen.getByRole("button", { name: "Flat" }));
    expect(onView).toHaveBeenCalledWith("flat");
  });
  it("in the Flat view the three 2D plots are shown instead of the cube", () => {
    setupCube({ view: "flat" });
    expect((document.querySelector(".flatwrap") as HTMLElement).hidden).toBe(false);
    expect((document.querySelector(".cubestage > canvas") as HTMLCanvasElement).hidden).toBe(true);
    expect(document.querySelectorAll(".flatwrap canvas")).toHaveLength(3);
  });
  it("the statistics block lists the three axes and maturity", () => {
    setupCube();
    expect([...document.querySelectorAll(".cubestats .sc b")].map((b) => b.textContent)).toEqual(["Calm", "Ease", "Awe", "Maturity"]);
    expect(screen.getByText(/The 4 songs in the list/)).toBeTruthy();
  });
  it("the legend explains the colors and the controls", () => {
    setupCube();
    const legend = document.querySelector(".cubelegend")!.textContent!;
    expect(legend).toContain("Dot color = maturity");
    expect(legend).toContain("hollow = no score");
    expect(legend).toContain("Drag to rotate");
  });
  it("with no songs in the list it says so", () => {
    setupCube({ rows: [] });
    expect(screen.getByText(/No songs in the selection/)).toBeTruthy();
    expect(screen.getByText("0 songs lit")).toBeTruthy();
  });
  it("has a button to reset the camera while the cube can be turned", () => {
    setupCube();
    expect(screen.getByRole("button", { name: /View/ })).toBeTruthy();
  });
});

describe("GraphPanel on Raw Feel", () => {
  const ranges = fullFeelRanges();
  const setupFeel = (order: number[]) =>
    render(<GraphPanel model={feelModel(order, ranges, ds.feelStats)} songs={ds.songs} rows={rated} showViewChoice={false} view="cube" onView={() => {}} />);

  it("no Cube/Flat choice, and a hint until a slider is narrowed", () => {
    setupFeel([]);
    expect(screen.queryByRole("button", { name: "Flat" })).toBeNull();
    expect(document.querySelector(".cubelegend")!.textContent).toContain("One dot color until a 4th slider is narrowed");
    expect(document.querySelectorAll(".cubestats .sc")).toHaveLength(10); // every scale, until a slider is narrowed
  });
  it("one or two scales (a line or a quadrant) cannot be turned, so there is no camera button", () => {
    setupFeel([idx("power"), idx("joyful")]);
    expect(screen.queryByRole("button", { name: /View/ })).toBeNull();
    expect(document.querySelector(".cubelegend")!.textContent).not.toContain("Drag to rotate");
  });
  it("three scales make the cube; a fourth names the dot color", () => {
    setupFeel([idx("power"), idx("joyful"), idx("tension"), idx("sadness")]);
    expect(screen.getByRole("button", { name: /View/ })).toBeTruthy();
    expect(document.querySelector(".cubelegend")!.textContent).toContain("Dot color = sadness");
    expect([...document.querySelectorAll(".cubestats .sc b")].map((b) => b.textContent)).toEqual(["Power", "Joyful", "Tension", "Sadness"]);
  });
  it("scales narrowed beyond four are named as not plotted", () => {
    setupFeel([0, 1, 2, 3, 4]);
    expect(screen.getByText(/also filtering, not plotted: Peacefulness/)).toBeTruthy();
  });
});
