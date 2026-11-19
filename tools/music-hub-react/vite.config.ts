import react from "@vitejs/plugin-react";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";

const here = fileURLToPath(new URL(".", import.meta.url));

/**
 * Dev only: serves the music-hub-core folder's data.js at /data.js (read-only), so `npm run dev` works without the Python helper.
 * Point MUSICLAB_DATA_JS at another data.js to use a different library.
 */
function serveDataJs(): Plugin {
  const file = process.env.MUSICLAB_DATA_JS ?? resolve(here, "../music-hub-core/data.js");
  return {
    name: "serve-music-hub-data",
    configureServer(server) {
      server.middlewares.use("/data.js", (_req, res) => {
        if (!existsSync(file)) {
          res.statusCode = 404;
          res.end(`data.js not found: ${file}`);
          return;
        }
        res.setHeader("Content-Type", "text/javascript; charset=utf-8");
        res.setHeader("Cache-Control", "no-store");
        res.end(readFileSync(file));
      });
    },
  };
}

/**
 * Dev only: the Python helper (tools/music-hub-core/helper.py, started with a page's serve.bat) streams the audio and talks to iTunes. The dev server hands its
 * routes on to it, so the app works the same as when the helper serves it. MUSICLAB_HELPER names another helper (default http://127.0.0.1:9123).
 * The helper only accepts requests that name itself as their origin, so the Origin header is rewritten.
 */
const helper = process.env.MUSICLAB_HELPER ?? "http://127.0.0.1:9123";
const HELPER_ROUTES = ["/audio", "/rate", "/playlist", "/rebuild", "/presence", "/ping", "/presets"];
const proxy = Object.fromEntries(
  HELPER_ROUTES.map((route) => [
    route,
    {
      target: helper,
      changeOrigin: true,
      configure: (p: { on: (event: string, cb: (req: { setHeader: (k: string, v: string) => void }) => void) => void }) =>
        p.on("proxyReq", (req) => req.setHeader("origin", helper)),
    },
  ]),
);

export default defineConfig({
  plugins: [react(), serveDataJs()],
  server: { host: "127.0.0.1", port: 5273, strictPort: true, proxy }, // not Vite's usual 5173, which other projects use
  test: {
    environment: "node", // a component test opts in to jsdom with a "@vitest-environment jsdom" comment at the top of the file
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
