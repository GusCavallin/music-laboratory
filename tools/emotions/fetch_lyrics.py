"""Fetches lyrics for songs, to help rate how they feel (private: the lyrics are copyrighted, so they stay on this machine).

    py -3 fetch_lyrics.py --artist "Death Cab For Cutie" --low-confidence
    py -3 fetch_lyrics.py --artist "Death Cab For Cutie" --low-confidence --dry-run

Picks songs from the iTunes library (read-only) that are already in gems.json, filtered by artist (substring, any case) and/or
`--low-confidence` (confidence 1), `--vocals` (songs with words), `--loved` and/or `--stars N` (your own stars, not album-computed), saves each song's lyrics in
`lyrics/<persistent id>.txt` and writes one combined file `lyrics/_combined_<what>.txt` to read in one go. `lyrics/` is git-ignored
and is never published. Songs already fetched are skipped. Sources, in order: LRCLIB (matches on artist, title and length), then
lyrics.ovh. Songs with no lyrics found are listed at the end (instrumentals have none). Only the artist and the title are sent.
Standard library only.
"""
import argparse
import json
import os
import plistlib
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", ".."))
from musiclab_config import SOURCE_LIBRARY  # noqa: E402
import emotions_data  # noqa: E402

OUT = os.path.join(HERE, "lyrics")
UA = "music-lab/0.5 (personal use, https://github.com/GusCavallin/music-laboratory)"
DELAY = 0.6  # seconds between requests, to be polite


def get_json(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=25) as r:
            return json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None
        raise
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
        return None


def title_variants(name):
    """The title as tagged, then with a trailing (...) or [...] removed, then cut at ' / ' or ' - '."""
    out = [name]
    cleaned = re.sub(r"\s*[\(\[][^\)\]]*[\)\]]\s*$", "", name).strip()
    if cleaned and cleaned not in out:
        out.append(cleaned)
    for sep in (" / ", " - "):
        if sep in name:
            first = name.split(sep)[0].strip()
            if first and first not in out:
                out.append(first)
    return out


def from_lrclib(artist, title, album, secs):
    for t in title_variants(title):
        q = urllib.parse.urlencode({"artist_name": artist, "track_name": t, "album_name": album or "", "duration": secs or ""})
        d = get_json("https://lrclib.net/api/get?" + q)
        time.sleep(DELAY)
        if d and d.get("plainLyrics"):
            return d["plainLyrics"], "lrclib"
        if d and d.get("instrumental"):
            return "", "instrumental"
    # a looser search; accept only an artist match and a length within 12 s
    for t in title_variants(title):
        d = get_json("https://lrclib.net/api/search?" + urllib.parse.urlencode({"artist_name": artist, "track_name": t}))
        time.sleep(DELAY)
        for c in d or []:
            if not c.get("plainLyrics"):
                continue
            if abs((c.get("duration") or 0) - (secs or 0)) <= 12 and artist.lower()[:6] in (c.get("artistName") or "").lower():
                return c["plainLyrics"], "lrclib-search"
    return None, None


def from_ovh(artist, title):
    for t in title_variants(title):
        d = get_json("https://api.lyrics.ovh/v1/%s/%s" % (urllib.parse.quote(artist), urllib.parse.quote(t)))
        time.sleep(DELAY)
        if d and d.get("lyrics"):
            return d["lyrics"].strip(), "lyrics.ovh"
    return None, None


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--artist", help="artist contains this text")
    ap.add_argument("--low-confidence", action="store_true", help="only songs rated with confidence 1")
    ap.add_argument("--stars", type=int, help="only songs you rated this many stars or more (your own, not computed)")
    ap.add_argument("--loved", action="store_true", help="also songs you loved (with --stars: loved or that many of your own stars)")
    ap.add_argument("--vocals", action="store_true", help="only songs with lyrics (instrumentals have no maturity rating)")
    ap.add_argument("--dry-run", action="store_true", help="list the songs, fetch nothing")
    ap.add_argument("--refetch", action="store_true", help="fetch again even when the lyrics are already saved")
    a = ap.parse_args()
    if not (a.artist or a.low_confidence or a.stars or a.loved):
        ap.error("give at least one of --artist, --low-confidence, --stars")

    gems = emotions_data.gems()["songs"]
    if not gems:
        sys.exit("No rated songs yet: queue some, rate them and run merge.py first (see README.md).")
    lib = plistlib.load(open(SOURCE_LIBRARY, "rb"))
    skip = set()  # artists in review-skip.txt are left out, unless --artist asks for one by name
    if not a.artist and os.path.exists(os.path.join(HERE, "review-skip.txt")):
        skip = {ln.strip().lower() for ln in open(os.path.join(HERE, "review-skip.txt"), encoding="utf-8") if ln.strip()}
    picked = []
    for t in lib["Tracks"].values():
        g = gems.get(t.get("Persistent ID"))
        if not g:
            continue
        if (t.get("Artist") or "").lower() in skip:
            continue
        if a.vocals and g.get("maturity") is None:
            continue
        if a.artist and a.artist.lower() not in (t.get("Artist") or "").lower():
            continue
        if a.low_confidence and g["confidence"] != 1:
            continue
        if a.stars or a.loved:  # loved, or your own stars (a star count computed from the album does not count)
            computed = t.get("Album Rating Computed") or t.get("Rating Computed")
            own = bool(a.stars) and not computed and (t.get("Rating") or 0) // 20 >= a.stars
            if not (own or (a.loved and t.get("Loved"))):
                continue
        picked.append(t)
    picked.sort(key=lambda t: (t.get("Artist", "").lower(), t.get("Album", "").lower(), t.get("Disc Number", 1), t.get("Track Number", 0)))
    print(len(picked), "songs")
    if a.dry_run:
        for t in picked:
            print("  ", t.get("Artist"), "|", t["Name"], "|", t.get("Album"))
        return

    os.makedirs(OUT, exist_ok=True)
    # the idx used in batches/*.csv, so the ratings can be written straight from the combined file
    idx_of = {r["persistent_id"]: r["idx"] for r in emotions_data.queue()}
    missing, combined = [], []
    for n, t in enumerate(picked, 1):
        pid, artist, title = t["Persistent ID"], t.get("Artist", ""), t["Name"]
        path = os.path.join(OUT, pid + ".txt")
        if os.path.exists(path) and not a.refetch:
            text = open(path, encoding="utf-8").read()
            how = "saved"
        else:
            text, how = from_lrclib(artist, title, t.get("Album"), (t.get("Total Time") or 0) // 1000)
            if text is None:
                text, how = from_ovh(artist, title)
            if text:
                open(path, "w", encoding="utf-8", newline="\n").write(text.strip() + "\n")
        print("  %3d/%d  %-14s %s - %s" % (n, len(picked), how or "NOT FOUND", artist, title))
        if text:
            combined.append((t, text.strip()))
        else:
            missing.append((artist, title, how))
    what = re.sub(r"[^A-Za-z0-9]+", "_", (a.artist or "all") + ("_lowconf" if a.low_confidence else "") + ("_%dstars" % a.stars if a.stars else "") + ("_loved" if a.loved else "")).strip("_")
    with open(os.path.join(OUT, "_combined_%s.txt" % what), "w", encoding="utf-8", newline="\n") as f:
        for t, text in combined:
            f.write("=== idx %s | %s | %s | %s | %ss ===\n%s\n\n" % (
                idx_of.get(t["Persistent ID"], "?"), t.get("Artist"), t["Name"], t.get("Album"), (t.get("Total Time") or 0) // 1000, text))
    print("\n%d with lyrics, %d without" % (len(combined), len(missing)))
    for artist, title, how in missing:
        print("   no lyrics:", artist, "-", title, "(instrumental)" if how == "instrumental" else "")
    print("combined file:", os.path.join(OUT, "_combined_%s.txt" % what))


if __name__ == "__main__":
    main()
