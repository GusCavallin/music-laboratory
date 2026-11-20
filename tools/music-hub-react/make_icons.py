"""Draws the app icons of the React preview (a white music note on teal) into public/: icon-192.png and icon-512.png. Standard library only.

    py -3 make_icons.py

The drawing is the one of the current page (../music-hub/make_icons.py); only the color differs, so the two installed apps can be told apart.
"""
import importlib.util
import os

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("vanilla_icons", os.path.join(HERE, "..", "music-hub", "make_icons.py"))
icons = importlib.util.module_from_spec(spec)
spec.loader.exec_module(icons)
icons.BG = (13, 148, 136)

if __name__ == "__main__":
    os.makedirs(os.path.join(HERE, "public"), exist_ok=True)
    for n in (192, 512):
        with open(os.path.join(HERE, "public", f"icon-{n}.png"), "wb") as f:
            f.write(icons.png(n))
        print("wrote public/icon-%d.png" % n)
