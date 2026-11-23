"""Builds data.demo.js, a demo library for Music Hub made from the published Feel ratings of classical recordings (data/classical-feel.csv).

    py -3 build_demo_data.py                  -> reads data/classical-feel.csv next to this script if there is one (an optional copy, git-ignored),
                                                 else ../../data/classical-feel.csv (the published file)
    py -3 build_demo_data.py some-file.csv    -> reads another file with the same columns

No iTunes library is needed. Start a page with `--demo` (for example `serve.bat --demo`) to open it on this data: the table, the filters, the
Raw Feel sliders and the Feel Axes cube all work; there is no audio to play, the stars cannot be changed and your own data.js, saved views
and library are not touched (data.demo.js and presets.demo.json are separate files). Writes data.demo.js next to this script (git-ignored).
"""
import csv, datetime, json, os, sys
from pathlib import Path

HERE = Path(__file__).parent
ROOT = HERE.parents[1]
CSV = next((p for p in (HERE / "data" / "classical-feel.csv", ROOT / "data" / "classical-feel.csv") if p.exists()), ROOT / "data" / "classical-feel.csv")
AXES = [ROOT / "tools" / "emotions" / "axes.json", ROOT / "data" / "feel-axes.json"]   # your own axes if you made them, else the published ones
VERSION = ROOT / "VERSION"
SCALES = ["wonder", "transcendence", "tenderness", "nostalgia", "peacefulness", "power", "joyful", "tension", "sadness", "maturity"]
COLS = ["name", "artist", "album", "composer", "genres", "country", "year", "stars", "loved", "plays", "last_played", "secs", "added", "bpm",
        "protected", "track", "tracks", "disc", "discs", "feel", "path"]   # the same columns as data.js (build_data.py)


def num(s, default=0):
    try:
        return int(float(s))
    except (TypeError, ValueError):
        return default


def main(csv_path=None):
    src = Path(csv_path or os.environ.get("MUSICLAB_DEMO_CSV") or CSV)
    if not src.exists():
        sys.exit(f"{src} not found. It is published in the repo as data/classical-feel.csv; pass the path of a file with those columns.")
    with open(src, encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f))
    items = []
    for r in rows:
        feel = [None if r[s] == "" else int(r[s]) for s in SCALES] + [num(r["confidence"], 1)]
        items.append([r["title"], r["artist"], r["album"], r["composer"], "classical", "", 0, num(r["stars"]), num(r["loved"]), 0, "",
                      num(r["seconds"]), "", 0, 0, num(r["track"]), 0, num(r["disc"]), 0, feel, ""])   # no file: path is empty
    # a small made-up CD archive, so the MP3 Archive tab has something to show: the first albums of 8-40 songs, each as one "CD"
    by_album = {}
    for r in rows:
        if r["album"]:
            by_album.setdefault(r["album"], []).append(r)
    cds = [rs for rs in by_album.values() if 8 <= len(rs) <= 40][:8]
    archive = [[r["title"], r["artist"], r["album"], "Classical", f"CD {i:02d}", num(r["track"]), 1, ""]
               for i, rs in enumerate(cds, 1) for r in sorted(rs, key=lambda r: (num(r["disc"]), num(r["track"])))]
    axes_file = next((p for p in AXES if p.exists()), None)
    data = {
        "itunes_cols": COLS, "itunes": items, "playlists": [], "archive_cols": ["name", "artist", "album", "category", "volume", "track", "in_itunes", "path"],
        "archive": archive, "axes": json.load(open(axes_file, encoding="utf-8")) if axes_file else None, "demo": 1,
        "built": datetime.datetime.now().strftime("%Y-%m-%d %H:%M"),
        "version": VERSION.read_text(encoding="utf-8").strip() if VERSION.exists() else "",
    }
    out = HERE / "data.demo.js"
    out.write_text("window.LIB = " + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n", encoding="utf-8")
    print(f"demo songs: {len(items)}  demo archive rows: {len(archive)}  data.demo.js: {out.stat().st_size/1e6:.2f} MB" + ("" if axes_file else "  (no axes file: the Feel Axes tab stays empty)"))


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else None)
