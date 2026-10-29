"""Mean and standard deviation of every Feel scale (tools/emotions/gems.json), for all rated songs and by group:
5, 4 and 3 stars, with 5 and 4 also split by loved / not loved. Stars and hearts are read from the iTunes library XML.

    py -3 stats.py        # prints the tables and writes stats.md next to this script
"""
import json, os, plistlib, statistics as st, sys
HERE = os.path.dirname(os.path.abspath(__file__))
import pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2]))  # the repo root, for musiclab_config
from musiclab_config import SOURCE_LIBRARY  # noqa: E402
LIB_XML = SOURCE_LIBRARY
gems = json.load(open(os.path.join(HERE, "gems.json"), encoding="utf-8"))
SC = gems["scales"]
songs = gems["songs"]
lib = plistlib.load(open(LIB_XML, "rb"))
info = {t["Persistent ID"]: (0 if t.get("Rating Computed") else t.get("Rating", 0) // 20, bool(t.get("Loved")))
        for t in lib["Tracks"].values()}
groups = {
    "All rated songs": lambda s, l: True,
    "5 stars": lambda s, l: s == 5,
    "5 stars, loved": lambda s, l: s == 5 and l,
    "5 stars, not loved": lambda s, l: s == 5 and not l,
    "4 stars": lambda s, l: s == 4,
    "4 stars, loved": lambda s, l: s == 4 and l,
    "4 stars, not loved": lambda s, l: s == 4 and not l,
    "3 stars": lambda s, l: s == 3,   # no 3-star song is loved, so no split
}


def table(pred):
    rows = [songs[p] for p in songs if p in info and pred(*info[p])]
    out = {}
    for k in SC:
        v = [r[k] for r in rows if r[k] is not None]
        out[k] = (len(v), st.mean(v), st.stdev(v) if len(v) > 1 else 0.0) if v else (0, 0.0, 0.0)
    return len(rows), out


md = ["# Feel scales: mean and standard deviation", "",
      "Source: `gems.json` (Claude's estimates, 0-10) joined with the iTunes stars and hearts. Sample standard deviation. "
      "Maturity is empty for instrumentals, so its n is smaller.", ""]
for name, pred in groups.items():
    n, t = table(pred)
    md += [f"## {name} ({n} songs)", "", "| Scale | n | Mean | Std dev |", "|---|---|---|---|"]
    md += [f"| {k} | {t[k][0]} | {t[k][1]:.2f} | {t[k][2]:.2f} |" for k in SC] + [""]
# one compact comparison: mean per scale across the groups
names = list(groups)
md += ["## Means side by side", "", "| Scale | " + " | ".join(names) + " |", "|---|" + "---|" * len(names)]
tabs = {n: table(p)[1] for n, p in groups.items()}
for k in SC:
    md.append(f"| {k} | " + " | ".join(f"{tabs[n][k][1]:.2f}" for n in names) + " |")
text = "\n".join(md) + "\n"
open(os.path.join(HERE, "stats.md"), "w", encoding="utf-8", newline="\n").write(text)
print(text)
