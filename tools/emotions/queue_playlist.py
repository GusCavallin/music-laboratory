"""Queues the songs of a library playlist that have no Feel rating yet, ready to be rated.

    py -3 queue_playlist.py "US Folk" --dry-run     only lists them
    py -3 queue_playlist.py "US Folk"               appends them to poc_songs.csv (new idx) and prints them

Songs already rated (in gems.json) are left alone. Only files on disk with an artist; videos and spoken word are skipped.
The library XML is read-only."""
import csv, json, os, pathlib, plistlib, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2]))  # the repo root, for musiclab_config
from musiclab_config import SOURCE_LIBRARY  # noqa: E402

SPOKEN = ("Podcast", "Spoken & Audio", "Spoken Word", "Audiobook")


def main(argv):
    dry = "--dry-run" in argv
    names = [a for a in argv if not a.startswith("--")]
    if len(names) != 1:
        sys.exit('usage: py -3 queue_playlist.py "Playlist name" [--dry-run]')
    lib = plistlib.load(open(SOURCE_LIBRARY, "rb"))
    pl = [p for p in lib["Playlists"] if p["Name"] == names[0]]
    if not pl:
        sys.exit("No playlist named " + repr(names[0]))
    by_id = {t["Track ID"]: t for t in lib["Tracks"].values()}
    f = os.path.join(HERE, "poc_songs.csv")
    have = list(csv.DictReader(open(f, encoding="utf-8-sig")))
    queued = {r["persistent_id"]: r for r in have}
    rated = set(json.load(open(os.path.join(HERE, "gems.json"), encoding="utf-8"))["songs"])
    todo, seen = [], set()
    total = skipped = 0
    for it in pl[0].get("Playlist Items", []):
        t = by_id.get(it["Track ID"])
        if not t:
            continue
        total += 1
        pid = t["Persistent ID"]
        if pid in rated or pid in seen:
            continue
        seen.add(pid)
        if t.get("Track Type") != "File" or t.get("Has Video") or t.get("Podcast") or not t.get("Artist") or t.get("Genre") in SPOKEN:
            skipped += 1
            continue
        todo.append(t)
    todo.sort(key=lambda t: (t.get("Artist", "").lower(), t.get("Album", "").lower(), t.get("Track Number", 0), t["Name"].lower()))
    print(f"{names[0]}: {total} songs, {len(todo)} not rated yet, {skipped} skipped (not a music file)")
    start = len(have)
    rows = []
    for t in todo:
        pid = t["Persistent ID"]
        if pid in queued:
            idx = int(queued[pid]["idx"])  # queued earlier but never rated
        else:
            idx = start + len(rows)
            rows.append([idx, pid, t.get("Artist", ""), t["Name"], t.get("Album", ""), t.get("Total Time", 0) // 1000])
        print(idx, "|", t.get("Artist", ""), "|", t["Name"], "|", t.get("Album", ""), "|", t.get("Total Time", 0) // 1000, "s | stars", (t.get("Rating", 0) // 20) or "-")
    if rows and not dry:
        with open(f, "a", encoding="utf-8-sig", newline="") as fh:
            csv.writer(fh).writerows(rows)
        print(len(rows), "songs added to poc_songs.csv, idx", rows[0][0], "to", rows[-1][0])


main(sys.argv[1:])
