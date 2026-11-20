#!/bin/sh
# Starts the helper of the React page and opens it in an app-style window (Chrome, else Edge). It builds the page first when
# dist/ is missing or older than the source (the first time you need `npm install` in this folder).
# Closing the app window stops the helper (--keep-alive to disable); Ctrl+C also stops it. If it is already running,
# this just opens the window again.
# Default port 9223 (the current page uses 9123, so both can run); a busy port makes it pick the next free one.
# Options (passed through): --port 9000   --browser edge   --tab (normal tab)   --no-browser   --keep-alive   --no-build
# "py -3" picks the newest installed Python (plain "python" can resolve to LibreOffice's bundled one).
cd "$(dirname "$0")" || exit 1
if command -v py >/dev/null 2>&1; then exec py -3 server.py "$@"; else exec python server.py "$@"; fi
