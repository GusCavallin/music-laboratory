#!/bin/sh
# Rebuild data.js (it moved to ../music-hub-core): this only passes on to the script there.
exec "$(dirname "$0")/../music-hub-core/build_data.sh"
