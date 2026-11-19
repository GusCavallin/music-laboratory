import { describe, expect, it } from "vitest";
import { CAM0, PITCH_LIMIT, ZOOM_MAX, ZOOM_MIN, makeProjector, normalize, rotate, zoomBy } from "./project";

describe("camera", () => {
  it("a drag turns the cube: sideways changes the yaw, up and down the pitch", () => {
    const r = rotate(CAM0, 100, 50);
    expect(r.yaw).toBeCloseTo(CAM0.yaw + 0.8, 10);
    expect(r.pitch).toBeCloseTo(CAM0.pitch + 0.4, 10);
    expect(r.zoom).toBe(CAM0.zoom);
  });
  it("the pitch stops before straight up or down", () => {
    expect(rotate(CAM0, 0, 100000).pitch).toBe(PITCH_LIMIT);
    expect(rotate(CAM0, 0, -100000).pitch).toBe(-PITCH_LIMIT);
  });
  it("the wheel zooms between a minimum and a maximum", () => {
    expect(zoomBy(CAM0, -100).zoom).toBeGreaterThan(CAM0.zoom);
    expect(zoomBy(CAM0, 100).zoom).toBeLessThan(CAM0.zoom);
    expect(zoomBy({ ...CAM0, zoom: 2.9 }, -10000).zoom).toBe(ZOOM_MAX);
    expect(zoomBy({ ...CAM0, zoom: 0.6 }, 10000).zoom).toBe(ZOOM_MIN);
  });
  it("does not change the camera it was given", () => {
    const cam = { ...CAM0 };
    rotate(cam, 10, 10);
    zoomBy(cam, 10);
    expect(cam).toEqual(CAM0);
  });
});

describe("makeProjector", () => {
  it("with no turn, the middle of the cube is the middle of the canvas, horizontally", () => {
    const p = makeProjector(400, 300, { yaw: 0, pitch: 0, zoom: 1 });
    const [x] = p(0, 0, 0);
    expect(x).toBeCloseTo(200, 6);
  });
  it("larger x is further right, larger y is higher on the screen", () => {
    const p = makeProjector(400, 300, { yaw: 0, pitch: 0, zoom: 1 });
    expect(p(1, 0, 0)[0]).toBeGreaterThan(p(-1, 0, 0)[0]);
    expect(p(0, 1, 0)[1]).toBeLessThan(p(0, -1, 0)[1]);
  });
  it("a nearer point is drawn larger (perspective) and has the greater depth", () => {
    const p = makeProjector(400, 300, { yaw: 0, pitch: 0, zoom: 1 });
    const near = p(0, 0, 1);
    const far = p(0, 0, -1);
    expect(near[2]).toBeGreaterThan(far[2]);
    expect(near[3]).toBeGreaterThan(far[3]);
  });
  it("zooming in spreads the points further from the centre", () => {
    const a = makeProjector(400, 300, { yaw: 0, pitch: 0, zoom: 1 })(1, 0, 0)[0] - 200;
    const b = makeProjector(400, 300, { yaw: 0, pitch: 0, zoom: 2 })(1, 0, 0)[0] - 200;
    expect(b).toBeCloseTo(a * 2, 6);
  });
  it("the whole cube outline is centred on the canvas at the starting view", () => {
    const p = makeProjector(600, 400, CAM0);
    const xs: number[] = [];
    const ys: number[] = [];
    for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) {
      const q = p(x, y, z);
      xs.push(q[0]);
      ys.push(q[1]);
    }
    expect((Math.min(...xs) + Math.max(...xs)) / 2).toBeCloseTo(300, 6);
    expect((Math.min(...ys) + Math.max(...ys)) / 2).toBeCloseTo(200, 6);
  });
});

describe("normalize", () => {
  it("maps an axis's extent to -1..1", () => {
    expect(normalize(0, -2, 2)).toBe(0);
    expect(normalize(2, -2, 2)).toBe(1);
    expect(normalize(-2, -2, 2)).toBe(-1);
    expect(normalize(5, 0, 10)).toBe(0);
  });
});
