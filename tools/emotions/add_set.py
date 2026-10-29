"""Appends a new set of songs to poc_songs.csv (idx continues) for rating: loved songs with the given own star rating
that are not in poc_songs.csv yet.   py -3 add_set.py 4      (4 = 4-star loved songs); add "unloved" for songs without a heart"""
import csv, os, plistlib, sys, urllib.parse
HERE = os.path.dirname(os.path.abspath(__file__))
import pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2]))  # the repo root, for musiclab_config
from musiclab_config import SOURCE_LIBRARY  # noqa: E402
stars = int(sys.argv[1]) if len(sys.argv) > 1 else 4
loved = not (len(sys.argv) > 2 and sys.argv[2] == "unloved")   # py -3 add_set.py 5 unloved = 5-star songs that are NOT loved
f = os.path.join(HERE, "poc_songs.csv")
have = list(csv.DictReader(open(f, encoding="utf-8-sig")))
known = {r["persistent_id"] for r in have}
lib = plistlib.load(open(SOURCE_LIBRARY, "rb"))
rows, seen = [], set()
for t in lib["Tracks"].values():
    if t.get("Track Type") != "File" or "Location" not in t or bool(t.get("Loved")) != loved or t.get("Rating Computed"):
        continue
    if t.get("Rating") != stars * 20 or t["Persistent ID"] in known:
        continue
    p = urllib.parse.unquote(t["Location"].replace("file://localhost/", "")).replace("/", "\\").lower()
    if p in seen:
        continue
    seen.add(p)
    rows.append((t.get("Artist", ""), t["Name"], t.get("Album", ""), t["Persistent ID"], t.get("Total Time", 0) // 1000))
rows.sort(key=lambda r: (r[0].lower(), r[1].lower()))
start = len(have)
with open(f, "a", encoding="utf-8-sig", newline="") as fh:
    w = csv.writer(fh)
    for i, r in enumerate(rows):
        w.writerow([start + i, r[3], r[0], r[1], r[2], r[4]])
print(len(rows), "songs added, idx", start, "to", start + len(rows) - 1)
