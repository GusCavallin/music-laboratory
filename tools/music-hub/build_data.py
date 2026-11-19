"""Kept so that `py -3 build_data.py` still works from this folder: the script moved to ../music-hub-core/build_data.py."""
import os
import runpy

here = os.path.dirname(os.path.abspath(__file__))
runpy.run_path(os.path.normpath(os.path.join(here, "..", "music-hub-core", "build_data.py")), run_name="__main__")
