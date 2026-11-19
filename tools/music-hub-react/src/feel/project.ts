/** The camera of the 3D cube: yaw and pitch in radians, and a zoom factor. */
export interface Camera {
  yaw: number;
  pitch: number;
  zoom: number;
}

/** The starting view: about three mouse-wheel ticks in. */
export const CAM0: Camera = { yaw: -0.6, pitch: 0.4, zoom: 1.4 };

export const ZOOM_MIN = 0.5;
export const ZOOM_MAX = 3;
export const PITCH_LIMIT = 1.5;

/** A turn by a mouse drag of dx, dy pixels. The pitch stops short of straight up or down. */
export function rotate(cam: Camera, dx: number, dy: number): Camera {
  return { ...cam, yaw: cam.yaw + dx * 0.008, pitch: Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, cam.pitch + dy * 0.008)) };
}

/** A mouse-wheel step (deltaY, positive = away from you) zooms out, negative zooms in. */
export function zoomBy(cam: Camera, deltaY: number): Camera {
  return { ...cam, zoom: Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, cam.zoom * (1 - deltaY * 0.0012))) };
}

/** A point on screen: x, y in pixels, the depth (bigger = nearer) and the perspective scale at that depth. */
export type Projected = [x: number, y: number, depth: number, scale: number];

/** Distance of the eye from the cube, in cube units: the smaller it is, the stronger the perspective. */
const EYE = 3.4;

/**
 * Turns points of the cube (each axis -1..1) into pixels for a canvas of w by h. The cube's outline (not its origin: perspective and tilt push
 * the outline down) is centered in the display area.
 */
export function makeProjector(w: number, h: number, cam: Camera): (x: number, y: number, z: number) => Projected {
  const radius = Math.min(w, h) * 0.2 * cam.zoom;
  const cyaw = Math.cos(cam.yaw);
  const syaw = Math.sin(cam.yaw);
  const cp = Math.cos(cam.pitch);
  const sp = Math.sin(cam.pitch);
  const turn = (x: number, y: number, z: number) => {
    const x1 = x * cyaw + z * syaw;
    const z1 = -x * syaw + z * cyaw;
    const y1 = y * cp - z1 * sp;
    const z2 = y * sp + z1 * cp;
    return { x1, y1, z2, s: EYE / (EYE - z2 * 0.9) };
  };
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) {
    const t = turn(x, y, z);
    x0 = Math.min(x0, t.x1 * t.s);
    x1 = Math.max(x1, t.x1 * t.s);
    y0 = Math.min(y0, t.y1 * t.s);
    y1 = Math.max(y1, t.y1 * t.s);
  }
  const cx = w / 2 - ((x0 + x1) / 2) * radius;
  const cy = h / 2 + ((y0 + y1) / 2) * radius;
  return (x, y, z) => {
    const t = turn(x, y, z);
    return [cx + t.x1 * t.s * radius, cy - t.y1 * t.s * radius, t.z2, t.s];
  };
}

/** A value of an axis, scaled to -1..1 across the axis's extent. */
export const normalize = (v: number, lo: number, hi: number): number => (v - (lo + hi) / 2) / ((hi - lo) / 2);
