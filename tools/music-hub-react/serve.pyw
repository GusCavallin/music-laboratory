"""The same as serve.bat, with no console window: double-click it, or point a shortcut at it (options after the file name work too:
--demo, --port 9000, --tab ...). It builds the page first when dist\ is out of date, then the helper starts; closing the app window stops
the helper. What serve.bat would print (the build too) is in logs\music-hub-react.log in the repo."""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "music-hub-core"))
import serve_hidden  # noqa: E402

serve_hidden.run(HERE)
