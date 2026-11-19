"""Starts the Music Hub helper for this page (index.html). The helper itself is shared: tools/music-hub-core/helper.py.

    python server.py [--port N] [--browser chrome|edge] [--tab] [--no-browser] [--keep-alive]   # or double-click serve.bat

Serves on http://127.0.0.1:9123 (or --port N / LIBRARY_SEARCH_PORT) only, this computer. What the helper does (playing, rating, saving
playlists and presets, rebuilding data.js, closing itself with the window) is described at the top of ../music-hub-core/helper.py.
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "music-hub-core"))
import helper  # noqa: E402

if __name__ == "__main__":
    helper.run(HERE, files=["index.html", "sw.js", "manifest.webmanifest", "icon-192.png", "icon-512.png"],
               port=9123, signature="music-library-search")
