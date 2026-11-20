import { describe, expect, it, vi } from "vitest";
import { registerServiceWorker } from "./pwa";

const host = () => ({ serviceWorker: { register: vi.fn(() => Promise.resolve({})) } });

describe("registerServiceWorker", () => {
  it("registers /sw.js for a built page served over http", () => {
    const h = host();
    registerServiceWorker(h, true, "http:");
    expect(h.serviceWorker.register).toHaveBeenCalledWith("/sw.js");
  });
  it("does nothing in the dev server (not a production build)", () => {
    const h = host();
    registerServiceWorker(h, false, "http:");
    expect(h.serviceWorker.register).not.toHaveBeenCalled();
  });
  it("does nothing when the page is not served over http (a file)", () => {
    const h = host();
    registerServiceWorker(h, true, "file:");
    expect(h.serviceWorker.register).not.toHaveBeenCalled();
  });
  it("does nothing in a browser without service workers", () => {
    expect(() => registerServiceWorker({}, true, "http:")).not.toThrow();
  });
  it("a refused registration is not an error", async () => {
    const h = { serviceWorker: { register: vi.fn(() => Promise.reject(new Error("no"))) } };
    expect(() => registerServiceWorker(h, true, "http:")).not.toThrow();
    await Promise.resolve();
  });
});
