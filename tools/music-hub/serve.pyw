"""The same as serve.bat, with no console window: double-click it, or point a shortcut at it (options after the file name work too:
--demo, --port 9000, --tab ...). Closing the app window stops the helper. What serve.bat would print is in logs\music-hub.log in the repo."""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "music-hub-core"))
import serve_hidden  # noqa: E402

serve_hidden.run(HERE)
