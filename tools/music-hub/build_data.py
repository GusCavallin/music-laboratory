"""Build data.js (iTunes library + old MP3 archive index) for index.html.

Reads (read-only): the source music library and, when they exist, release_years.csv, artist_genres.csv and the CD archive spreadsheet (cd_archive_index in config.json).
Writes: data.js next to this script (git-ignored, regenerable).
"""
import csv, datetime, json, plistlib, re, sys, unicodedata, urllib.parse, zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

HERE = Path(__file__).parent
import pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2]))  # the repo root, for musiclab_config
from musiclab_config import CD_ARCHIVE_INDEX, SOURCE_LIBRARY  # noqa: E402
LIB_XML = SOURCE_LIBRARY
XLSX = CD_ARCHIVE_INDEX   # optional (cd_archive_index in config.json)
YEARS = HERE.parent / "release-years" / "release_years.csv"
GENRES = HERE.parent / "artist-genres" / "artist_genres.csv"
AXES = HERE.parent / "emotions" / "axes.json"   # optional: the three independent axes of the Feel Axes tab (tools/emotions/axes.py)
GEMS = HERE.parent / "emotions" / "gems.json"   # optional: emotional-tone ratings (tools/emotions)
BPM = HERE.parent / "bpm" / "bpm.csv"   # optional: tempo from AcousticBrainz (tools/bpm/update_bpm.py)
VERSION = HERE.parents[1] / "VERSION"   # one line at the repo root, written by a release (see CONVENTIONS.md, Versioning)


def norm(s):
    s = unicodedata.normalize("NFKD", s or "").lower()
    s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


def winpath(t):
    return urllib.parse.unquote(t["Location"].replace("file://localhost/", "")).replace("/", "\\")


def read_csv(p):
    if not Path(p).exists():   # the indexes are built by the scripts in tools/release-years and tools/artist-genres: optional here
        print(f"note: {p.name} not found, skipping (run the update script in {p.parent.name}/ to build it)")
        return []
    with open(p, encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def itunes_rows():
    years = {r["persistent_id"]: r["original_year"] for r in read_csv(YEARS)}
    bpm = {r["persistent_id"]: float(r["bpm"]) for r in read_csv(BPM) if r["bpm"]} if BPM.exists() else {}
    ag = {r["artist"]: r for r in read_csv(GENRES)}
    gems = json.load(open(GEMS, encoding="utf-8"))["songs"] if GEMS.exists() else {}
    scales = json.load(open(GEMS, encoding="utf-8"))["scales"] if GEMS.exists() else []
    lib = plistlib.load(open(LIB_XML, "rb"))
    rows, by_path, by_id = [], {}, {}
    for t in lib["Tracks"].values():
        if t.get("Track Type") != "File" or "Location" not in t:
            continue
        path = winpath(t)
        if path in by_path:  # same file listed twice: one row, both Track IDs point at it
            by_id[t["Track ID"]] = by_path[path]
            continue
        by_path[path] = by_id[t["Track ID"]] = len(rows)
        a = ag.get(t.get("Artist", ""), {})
        rating = 0 if t.get("Rating Computed") else t.get("Rating", 0) // 20
        rows.append([
            t.get("Name", ""), t.get("Artist", ""), t.get("Album", ""), t.get("Composer", ""),
            a.get("genres", ""), a.get("country", ""),
            int(years.get(t["Persistent ID"]) or t.get("Year") or 0),
            rating, int(bool(t.get("Loved"))), t.get("Play Count", 0),
            t["Play Date UTC"].strftime("%Y-%m-%d") if "Play Date UTC" in t else "",
            t.get("Total Time", 0) // 1000, t["Date Added"].strftime("%Y-%m-%d") if "Date Added" in t else "",
            int(round(bpm.get(t["Persistent ID"], 0))),  # 0 = no tempo known
            int(bool(t.get("Protected"))),                # 1 = copy-protected purchase (.m4p): a browser cannot play it
            ([g[s] for s in scales] + [g["confidence"]]) if (g := gems.get(t["Persistent ID"])) else None,  # 10 scores (0-10, None = n/a) + confidence 1-3
            path,
        ])
    return rows, by_id, lib


def playlists(lib, by_id):
    """User playlists (smart ones too: their current members are listed) as [name, [row index, ...], smart (0/1)]."""
    by_pid = {p["Playlist Persistent ID"]: p for p in lib["Playlists"]}

    def full_name(p):
        parent = by_pid.get(p.get("Parent Persistent ID"))
        return (full_name(parent) + " / " if parent else "") + p["Name"]
    out = []
    for p in lib["Playlists"]:
        if p.get("Master") or p.get("Folder") or "Distinguished Kind" in p:
            continue
        ids = [by_id[i["Track ID"]] for i in p.get("Playlist Items", []) if i["Track ID"] in by_id]
        if ids:
            out.append([full_name(p), ids, int("Smart Info" in p or "Smart Criteria" in p)])
    return sorted(out, key=lambda x: x[0].lower())


# --- text damaged in the CD index spreadsheet ---------------------------------------------------------------
# A character that was lost when the index was made shows up as "ï¿½" (the UTF-8 bytes of the Unicode replacement
# character read as Windows-1252). mojibake_fixes.json maps each damaged WORD to its real spelling ("?" in a key
# stands for one lost character). A damaged word that is not listed gets a plain replacement mark instead.
DMG = "ï¿½"
SENT = ""


def _load_fixes():
    try:
        raw = json.load(open(HERE / "mojibake_fixes.json", encoding="utf-8")).get("fixes", {})
    except (OSError, ValueError):
        raw = {}
    return {k.replace("?", SENT): v for k, v in raw.items()}


FIXES = _load_fixes()


def fix_text(s):
    if not s or (DMG not in s and "�" not in s):
        return s
    out, cur = [], ""
    for c in s.replace(DMG, SENT).replace("�", SENT) + " ":  # trailing space flushes the last word
        if c.isalpha() or c == SENT:
            cur += c
            continue
        if cur:
            out.append(FIXES.get(cur, cur) if SENT in cur else cur)
            cur = ""
        out.append(c)
    return "".join(out)[:-1].replace(SENT, "�")


def xlsx_rows():
    if not XLSX:
        return []
    M = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
    z = zipfile.ZipFile(XLSX)
    ss = ["".join(t.text or "" for t in si.iter(M + "t")) for si in ET.fromstring(z.read("xl/sharedStrings.xml"))]
    out = []
    for r in ET.fromstring(z.read("xl/worksheets/sheet1.xml")).iter(M + "row"):
        d = {}
        for c in r:
            v = c.find(M + "v")
            if v is not None:
                d[re.match("[A-Z]+", c.get("r")).group()] = fix_text(ss[int(v.text)]) if c.get("t") == "s" else v.text
        if "J" in d:   # the path on the CD: its drive letter only says which CD drive the disc was read in, so it is replaced by $DL
            d["J"] = re.sub(r"^[A-Za-z]:", "$DL", d["J"])
        out.append(d)
    return out[1:]  # drop header


def main():
    it, by_id, lib = itunes_rows()
    pls = playlists(lib, by_id)
    have = {(norm(r[1]), norm(r[0])) for r in it}
    arch = []
    for d in xlsx_rows():
        if not d.get("C"):
            continue
        key = (norm(d.get("B", "")), norm(d["C"]))
        arch.append([d["C"], d.get("B", "").strip("' "), d.get("D", ""), d.get("E", ""), d.get("F", ""),
                     int(d["A"]) if d.get("A", "").isdigit() else 0, int(key in have), d.get("J", "")])
    data = {
        "itunes_cols": ["name", "artist", "album", "composer", "genres", "country", "year", "stars", "loved",
                        "plays", "last_played", "secs", "added", "bpm", "protected", "feel", "path"],
        "itunes": it,
        "playlists": pls,
        "archive_cols": ["name", "artist", "album", "category", "volume", "track", "in_itunes", "path"],
        "archive": arch,
        "axes": json.load(open(AXES, encoding="utf-8")) if AXES.exists() else None,
        "built": datetime.datetime.now().strftime("%Y-%m-%d %H:%M"),
        "version": VERSION.read_text(encoding="utf-8").strip() if VERSION.exists() else "",   # shown in the About box; empty until the first release
    }
    out = HERE / "data.js"
    out.write_text("window.LIB = " + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n", encoding="utf-8")
    print(f"iTunes tracks: {len(it)}  playlists: {len(pls)}  archive rows: {len(arch)} ({sum(r[6] for r in arch)} also in iTunes)  "
          f"data.js: {out.stat().st_size/1e6:.1f} MB")


if __name__ == "__main__":
    sys.exit(main())
