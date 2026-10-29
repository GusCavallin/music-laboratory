"""Original-release-year index for the iTunes library, backed by MusicBrainz.

    python update_index.py              # look up only tracks not yet in the cache, then rebuild the index
    python update_index.py --dry-run    # just report how many lookups are pending
    python update_index.py --limit 50   # cap the number of MusicBrainz lookups this run
    python update_index.py --retry-nomatch   # re-query keys that previously found nothing

Files (all in this folder):
    mb_cache.json       lookup results keyed by song (artist|title|variant) -- the expensive part, never discarded
    release_years.csv   one row per library file track, rebuilt from cache + current library on every run

Rules:
    * Studio originals on compilations/best-ofs get the year the recording was FIRST released.
    * Live / unplugged / acoustic / remix / demo versions are distinct recordings: they get the first
      release of that specific recording, never the studio original's year.
    * Classical (composer era is a different question) and podcasts are indexed but not looked up.
"""
import argparse, csv, datetime, json, os, plistlib, re, sys, time, unicodedata
import urllib.error, urllib.parse, urllib.request

import pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2]))  # the repo root, for musiclab_config
from musiclab_config import SOURCE_LIBRARY  # noqa: E402
LIBRARY = SOURCE_LIBRARY
HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, "mb_cache.json")
INDEX = os.path.join(HERE, "release_years.csv")
from musiclab_config import CONTACT_EMAIL  # noqa: E402
UA = f"music-lab/0.2 ( {CONTACT_EMAIL} )" if CONTACT_EMAIL else None  # MusicBrainz asks lookups to say how to reach the person running them
CLASSICAL_PLAYLISTS = {"Classical", "Classical Piano", "Classical Violin", "+ All Classical +",
                       "++ Best Classical ++", "++ Best Classical Piano ++"}

# Qualifiers that mean "a different recording" vs. "same recording, different packaging".
VARIANT = re.compile(r"\b(live|en vivo|ao vivo|en directo|unplugged|acoustic|ac[uú]stic[oa]|demo|remix|"
                     r"rmx|mix|dub|rehearsal|session|instrumental|orchestral|re-?recorded|"
                     r"(19|20)\d\d version|new version)\b", re.I)
SAME = re.compile(r"\b(remaster(ed)?|radio edit|edit|single version|album version|mono|stereo|"
                  r"feat\.?|featuring|ft\.|with|bonus( track)?|explicit|clean|previously unreleased|"
                  r"original( version)?|lp version|digital|deluxe|from .*)\b", re.I)
LIVE_ALBUM = re.compile(r"\b(live|unplugged|en vivo|ao vivo|en directo|in concert|mtv)\b", re.I)
# Disambiguations marking a *different recording*. Plain "mix"/"edit"/"version" are not here:
# "original stereo mix", "radio edit", "single version" are the same performance.
BAD_DISAMBIG = re.compile(r"live|demo|remix|extended|club|dub|acoustic|unplugged|instrumental|karaoke|"
                          r"rehearsal|session|cover|a cappella|orchestral|re-?record", re.I)


def norm(s):
    s = unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode().lower()
    s = re.sub(r"^the\s+", "", s.strip())
    s = s.replace("&", " and ")
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


def primary_artist(a):
    # only split off guests; "&" and "," belong to real names (Simon & Garfunkel, Earth, Wind & Fire)
    return re.split(r"\s+(?:feat\.?|featuring|ft\.|with|vs\.?)\s+|\s*[\(\[]feat", a or "", maxsplit=1, flags=re.I)[0].strip()


def split_title(title, album):
    """-> (clean title, variant label or '')"""
    t, variant = title, ""
    while True:  # peel trailing "(...)", "[...]" and " - ..." qualifiers
        m = re.search(r"\s*(?:[\(\[]([^\(\)\[\]]*)[\)\]]|\s-\s([^-]+))\s*$", t)
        if not m:
            break
        q = m.group(1) or m.group(2)
        if VARIANT.search(q):
            variant = variant or VARIANT.search(q).group(0).lower()
        elif not SAME.search(q):
            break  # part of the real title, e.g. "(I Can't Get No) Satisfaction" keeps its lead
        t = t[:m.start()]
    if not variant and LIVE_ALBUM.search(album or ""):
        variant = "live"
    return t.strip() or title, variant


def track_key(t):
    title, variant = split_title(t.get("Name", ""), t.get("Album", ""))
    parts = [norm(primary_artist(t.get("Artist") or t.get("Album Artist") or "")), norm(title), variant]
    if variant:
        parts.append(norm(t.get("Album", "")))
    return "|".join(parts), title, variant


# --- MusicBrainz -------------------------------------------------------------------------------
_last = [0.0]


def mb_get(path):
    """GET https://musicbrainz.org/ws/2/<path> politely (1 req/s, backoff); returns the body as text."""
    if not UA:
        sys.exit("music-lab: set contact_email in config.json (or MUSICLAB_CONTACT_EMAIL): MusicBrainz wants a way to reach you in the User-Agent.")
    for attempt in range(6):
        wait = 1.1 - (time.time() - _last[0])
        if wait > 0:
            time.sleep(wait)
        _last[0] = time.time()
        url = "https://musicbrainz.org/ws/2/" + path
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=30) as r:
                return r.read().decode("utf-8")
        except urllib.error.HTTPError as e:
            if e.code in (429, 503):
                time.sleep(5 * (attempt + 1))
                continue
            raise
        except (urllib.error.URLError, TimeoutError):
            time.sleep(5 * (attempt + 1))
    raise RuntimeError("MusicBrainz unreachable")


def mb_search(query, entity="recording", limit=100):
    return json.loads(mb_get(f"{entity}?fmt=json&limit={limit}&query=" + urllib.parse.quote(query)))


def lucene(s):
    return s.replace("\\", "\\\\").replace('"', '\\"')


def credit_names(rec, raw=False):
    f = (lambda s: s or "") if raw else norm
    names = set()
    for c in rec.get("artist-credit", []):
        if isinstance(c, dict):
            names.add(f(c.get("name")))
            names.add(f(c.get("artist", {}).get("name")))
    return names


def is_live_recording(rec):
    if re.search(r"live|unplugged", rec.get("disambiguation", ""), re.I):
        return True
    rels = rec.get("releases", [])
    return bool(rels) and all("Live" in (r.get("release-group", {}).get("secondary-types") or []) for r in rels)


def strip_subtitle(s):
    """Drop trailing "(...)"/"[...]" subtitles: "El Condor Pasa (If I Could)" -> "El Condor Pasa"."""
    while True:
        t = re.sub(r"\s*[\(\[][^\(\)\[\]]*[\)\]]\s*$", "", s)
        if t == s or not t.strip():
            return s
        s = t


def same(s):
    """Comparison form (not used for cache keys): also ignores straight/curly apostrophes."""
    return norm(re.sub(r"['’‘`´]", "", s or ""))


def lookup(artist, title, variant, album, length_ms):
    st = strip_subtitle(title)
    # MusicBrainz often drops a leading "The" ("Carpenters"), so accept both spellings
    artists = [artist] + ([artist[4:]] if artist.lower().startswith("the ") else [])
    aq = " OR ".join(f'artist:"{lucene(x)}"' for x in artists)
    q = f'recording:"{lucene(st)}" AND ({aq}) AND video:false'
    res = mb_search(q)
    a, bt = same(artist), same(st)
    cands = [r for r in res.get("recordings", [])
             if a in {same(n) for n in credit_names(r, raw=True)} and same(strip_subtitle(r.get("title", ""))) == bt
             and r.get("first-release-date")]
    out = {"query": q, "candidates": len(cands)}

    def near(r, tol):
        return length_ms and r.get("length") and abs(r["length"] - length_ms) <= tol

    if not variant:
        studio = [r for r in cands if not BAD_DISAMBIG.search(r.get("disambiguation", "")) and not is_live_recording(r)]
        if not studio:
            return {**out, "method": "no-match"}
        best = min(studio, key=lambda r: r["first-release-date"])
        year = best["first-release-date"][:4]
        support = sum(1 for r in studio if r["first-release-date"][:4] == year)
        conf = "high" if support >= 2 or near(best, 15000) else "medium"
        return {**out, "method": "original", "date": best["first-release-date"], "mbid": best["id"],
                "confidence": conf, "support": support}

    # Variant: find the recording that appears on this very album, else a matching-kind recording.
    nalb = norm(album)
    on_album = [r for r in cands if any(norm(x.get("title")) == nalb for x in r.get("releases", []))]
    if on_album:
        best = min(on_album, key=lambda r: r["first-release-date"])
        return {**out, "method": "variant-album", "date": best["first-release-date"], "mbid": best["id"],
                "confidence": "high"}
    if variant in ("live", "unplugged", "en vivo", "ao vivo", "en directo"):
        kind = [r for r in cands if is_live_recording(r) and near(r, 8000)]
    else:
        kind = [r for r in cands if re.search(re.escape(variant), r.get("disambiguation", "") + r.get("title", ""), re.I)
                and near(r, 8000)]
    if kind:
        best = min(kind, key=lambda r: r["first-release-date"])
        return {**out, "method": "variant-similar", "date": best["first-release-date"], "mbid": best["id"],
                "confidence": "low"}
    return {**out, "method": "no-match"}


# --- main --------------------------------------------------------------------------------------
def load_json(p):
    try:
        return json.load(open(p, encoding="utf-8"))
    except FileNotFoundError:
        return {}


def save_json(p, data):
    tmp = p + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1, sort_keys=True)
    os.replace(tmp, p)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--retry-nomatch", action="store_true")
    args = ap.parse_args()

    lib = plistlib.load(open(LIBRARY, "rb"))
    classical = set()
    for p in lib["Playlists"]:
        if p.get("Name") in CLASSICAL_PLAYLISTS:
            classical.update(i["Track ID"] for i in p.get("Playlist Items", []))

    seen, rows = set(), []
    for t in lib["Tracks"].values():
        if t.get("Track Type") != "File" or "Location" not in t or t["Location"] in seen:
            continue
        seen.add(t["Location"])
        g = (t.get("Genre") or "").lower()
        if t.get("Podcast") or "podcast" in g or g in ("science & medicine", "audiobooks", "spoken word"):
            kind = "podcast"
        elif t["Track ID"] in classical or "classical" in g or "opera" in g:
            kind = "classical"
        elif not (t.get("Artist") or t.get("Album Artist")):
            kind = "no-artist"
        else:
            kind = "music"
        key, title, variant = track_key(t)
        rows.append((t, kind, key, title, variant))

    cache = load_json(CACHE)
    # rated first, then most played, so partial runs cover what matters most
    rows.sort(key=lambda r: (-(r[0].get("Rating", 0) if not r[0].get("Rating Computed") else 0),
                             -r[0].get("Play Count", 0)))
    pending, queued = [], set()
    for t, kind, key, title, variant in rows:
        if kind != "music" or key in queued:
            continue
        c = cache.get(key)
        if c is None or (args.retry_nomatch and c.get("method") == "no-match"):
            pending.append((t, key, title, variant))
            queued.add(key)
    print(f"{len(rows)} file tracks, {len(cache)} cached songs, {len(pending)} lookups pending", flush=True)
    if args.dry_run:
        return
    if args.limit:
        pending = pending[:args.limit]

    try:
        for n, (t, key, title, variant) in enumerate(pending, 1):
            artist = primary_artist(t.get("Artist") or t.get("Album Artist"))
            try:
                r = lookup(artist, title, variant, t.get("Album", ""), t.get("Total Time"))
            except Exception as e:  # leave uncached so the next run retries it
                print(f"  ! {artist} - {title}: {e}", flush=True)
                continue
            r["fetched"] = datetime.date.today().isoformat()
            cache[key] = r
            if n % 25 == 0:
                save_json(CACHE, cache)
                print(f"  {n}/{len(pending)} looked up", flush=True)
    finally:
        save_json(CACHE, cache)

    with open(INDEX, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(["persistent_id", "artist", "name", "album", "kind", "variant", "tag_year", "original_year",
                    "source", "confidence", "mb_recording_id", "location"])
        for t, kind, key, title, variant in rows:
            tag = t.get("Year") if 1900 < (t.get("Year") or 0) <= datetime.date.today().year else None
            c = cache.get(key, {}) if kind == "music" else {}
            year, source, conf = tag, ("tag" if tag else ""), ""
            if c.get("date"):
                mb = int(c["date"][:4])
                conf = c["confidence"]
                if tag and tag < mb:  # an album can't predate the recording: trust the earlier tag
                    year, source, conf = tag, "tag<mb", "medium"
                else:
                    year, source = mb, "musicbrainz:" + c["method"]
            elif kind == "music" and key in cache:
                source, conf = "tag (no mb match)", "low"
            loc = urllib.parse.unquote(t["Location"].replace("file://localhost/", "")).replace("/", "\\")
            w.writerow([t.get("Persistent ID"), t.get("Artist", ""), t.get("Name", ""), t.get("Album", ""), kind,
                        variant, tag or "", year or "", source, conf, c.get("mbid", ""), loc])
    print(f"index written: {INDEX}", flush=True)


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
