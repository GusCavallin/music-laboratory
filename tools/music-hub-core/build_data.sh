#!/bin/sh
# Rebuild data.js from the iTunes library XML and the MP3 archive spreadsheet.
# "py -3" picks the newest installed Python (plain "python" can resolve to LibreOffice's bundled one).
cd "$(dirname "$0")" || exit 1
if command -v py >/dev/null 2>&1; then py -3 build_data.py; else python build_data.py; fi
