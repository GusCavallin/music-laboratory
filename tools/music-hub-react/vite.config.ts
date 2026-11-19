import react from "@vitejs/plugin-react";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";

const here = fileURLToPath(new URL(".", import.meta.url));

/**
 * Dev only: serves the music-hub folder's data.js at /data.js (read-only), so `npm run dev` works without the Python helper.
 * Point MUSICLAB_DATA_JS at another data.js to use a different library.
 */
function serveDataJs(): Plugin {
  const file = process.env.MUSICLAB_DATA_JS ?? resolve(here, "../music-hub/data.js");
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

export default defineConfig({
  plugins: [react(), serveDataJs()],
  test: {
    environment: "node", // a component test opts in to jsdom with a "@vitest-environment jsdom" comment at the top of the file
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
