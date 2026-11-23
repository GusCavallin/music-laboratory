"""Starts the Music Hub helper for the React page: it serves the built page (dist\\) and does everything the current page's helper does.

    python server.py [--port N] [--browser chrome|edge] [--tab] [--no-browser] [--keep-alive] [--no-build]   # or double-click serve.bat

Serves on http://127.0.0.1:9223 (or --port N / LIBRARY_SEARCH_PORT) only, this computer; the current page has 9123, so both can run at once.
The helper itself is shared: ../music-hub-core/helper.py (it describes the routes, the presence rule and the options).

Before it starts it builds the page (npm run build) when dist\\ is missing or older than the source, so what you see is what is in src\\.
--no-build skips that and serves dist\\ as it is (what preview.bat does: the dev server serves the page there, the helper only does the work).
The first time you need `npm install` in this folder.
"""
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
DIST = os.path.join(HERE, "dist")
SOURCES = ["src", "public", "index.html", "package.json", "package-lock.json", "vite.config.ts", "tsconfig.json"]  # what a build is made from
sys.path.insert(0, os.path.join(HERE, "..", "music-hub-core"))
import helper  # noqa: E402

PORT, SIGNATURE = 9223, "music-hub-react"


def newest_source(root=HERE):
    """The latest modification time among the files the build is made from (0 when there are none)."""
    newest = 0.0
    for name in SOURCES:
        path = os.path.join(root, name)
        if os.path.isfile(path):
            newest = max(newest, os.path.getmtime(path))
        for folder, _dirs, files in os.walk(path):
            for f in files:
                newest = max(newest, os.path.getmtime(os.path.join(folder, f)))
    return newest


def build_needed(root=HERE):
    """True when dist\\index.html is missing or something it is built from changed after it."""
    built = os.path.join(root, "dist", "index.html")
    return not os.path.isfile(built) or newest_source(root) > os.path.getmtime(built)


def build(root=HERE):
    """Runs `npm run build`; returns True when it worked. Says what to do when npm or node_modules is missing."""
    if not os.path.isdir(os.path.join(root, "node_modules")):
        print("The page is not built and node_modules is missing: run `npm install` in this folder once, then start again.", flush=True)
        return False
    print("Building the page (npm run build)...", flush=True)
    try:
        r = subprocess.run(["npm", "run", "build"], cwd=root, shell=(os.name == "nt"), creationflags=helper.NO_WINDOW)  # on Windows npm is npm.cmd
    except OSError:
        print("npm was not found: install Node.js, or start with --no-build to serve what is in dist\\.", flush=True)
        return False
    if r.returncode != 0:
        print("The build failed (see above). Fix it, or start with --no-build to serve the previous build.", flush=True)
    return r.returncode == 0


if __name__ == "__main__":
    if "--no-build" not in sys.argv and build_needed() and not build():
        sys.exit(1)
    if not os.path.isfile(os.path.join(DIST, "index.html")):
        print("Note: dist\\ has no build, so the helper has no page to show (the dev server, `npm run dev`, serves it instead).", flush=True)
    helper.run(DIST, port=PORT, signature=SIGNATURE)
