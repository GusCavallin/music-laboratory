"""Energetic workout playlist: your best-rated songs that are fast, danceable and busy (not ballads).

    py -3 workout_playlist.py --name "Road bike ride"
        [--min-rating 4] [--min-dance 1.06] [--min-onset 3.2] [--min-bpm 110]
        [--seed "Everything But The Girl|Wrong"] ...      # always include (songs AcousticBrainz has no data for)
        [--drop "Artist|Title"] ...                       # always leave out
        [--explain "Travis|Love Will Come Through"] ...   # say why a song is in or out
        [--dry-run]                                       # report only, write nothing

Why not just BPM? The tempo estimator often reports double the real tempo for slow songs (a ballad at 75 shows as
150), so BPM alone lets ballads through. Danceability and onset rate (note/beat events per second) from AcousticBrainz
separate them: on hand-picked examples the good songs scored danceability 1.10-1.21 and onset 3.5-4.6, the ballads and
jazz 0.92-1.04 and 2.1-2.9.

Rules, in order (each song is counted under the first one that removes it):
  rating     hand rating below --min-rating (a rating inherited from the album does not count)
  video      a video file
  kids / holiday / spoken   children's music, Christmas etc., spoken word (contexts.json + title/album/genre patterns)
  classical / jazz          artist genre tags (MusicBrainz) or the iTunes Genre
  no data    AcousticBrainz has no tempo for it (songs you name with --seed are still included)
  calm       danceability, onset rate or tempo below the minimums
Writes playlists/[Gen] <name>.m3u8 (UTF-8, CRLF, absolute paths), in a fixed shuffled order.
"""
import argparse, collections, csv, json, os, plistlib, random, re, sys, urllib.parse

HERE = os.path.dirname(os.path.abspath(__file__))
TOOLS = os.path.dirname(HERE)
ROOT = os.path.dirname(TOOLS)
sys.path.insert(0, os.path.join(TOOLS, "release-years"))
from update_index import LIBRARY, norm, primary_artist  # noqa: E402

VIDEO_EXT = {".m4v", ".mp4", ".mov", ".mpg", ".avi", ".wmv"}
HOLIDAY = re.compile(r"christmas|xmas|holiday|navidad|noel\b|no[eë]l\b|jingle|santa claus", re.I)
KIDS_GENRE = re.compile(r"child|chilren|kids|lullab|infantil|nursery", re.I)
# whole tags only: "baroque pop", "chamber pop" or "symphonic rock" are pop/rock, not classical
CLASSICAL_TAGS = {"classical", "baroque", "opera", "orchestral", "romantic", "renaissance", "medieval", "early music",
                  "contemporary classical", "modern classical", "chamber music", "choral", "classical crossover",
                  "20th century classical", "impressionist", "minimalism", "neoclassical", "late romantic"}
CLASSICAL_GENRE = re.compile(r"classical|opera|baroque|orchestral|choral", re.I)   # the iTunes Genre field
JAZZ_TAGS = {"jazz", "bebop", "hard bop", "cool jazz", "smooth jazz", "contemporary jazz", "vocal jazz", "swing",
             "big band", "free jazz", "modal jazz", "latin jazz", "jazz fusion", "dixieland", "ragtime", "bossa nova"}


def winpath(t):
    return urllib.parse.unquote(t["Location"].replace("file://localhost/", "")).replace("/", "\\")


def pair(s):
    a, _, t = s.partition("|")
    return a.strip().lower(), t.strip().lower()


def matches(t, a, ti):
    return a in (t.get("Artist", "") or "").lower() and (t.get("Name", "") or "").lower().startswith(ti)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--name", default="Road bike ride")
    ap.add_argument("--min-rating", type=int, default=4)
    ap.add_argument("--min-dance", type=float, default=1.06)
    ap.add_argument("--min-onset", type=float, default=3.2)
    ap.add_argument("--min-bpm", type=float, default=110)
    ap.add_argument("--min-epb", type=float, default=1.3,
                    help="min note events per measured beat: a ballad measured at double tempo has about 1, real fast songs 1.4+")
    ap.add_argument("--candidates", type=int, default=0, help="list N songs without data (best-played first) you could add with --seed")
    ap.add_argument("--seed", action="append", default=[])
    ap.add_argument("--drop", action="append", default=[])
    ap.add_argument("--explain", action="append", default=[])
    ap.add_argument("--show", type=int, default=0, help="print N random chosen songs with their measurements")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()

    feats = {r["persistent_id"]: r for r in csv.DictReader(open(os.path.join(HERE, "bpm.csv"), encoding="utf-8-sig")) if r["bpm"]}
    genres = {norm(r["artist"]): r["genres"].lower() for r in csv.DictReader(open(os.path.join(TOOLS, "artist-genres", "artist_genres.csv"), encoding="utf-8-sig"))}
    ctx_file = os.path.join(TOOLS, "taste-report", "contexts.json")   # optional: artist lists for children's and spoken-word music
    ctx = json.load(open(ctx_file, encoding="utf-8")) if os.path.exists(ctx_file) else {}
    kids = {norm(x) for x in ctx.get("kids", [])}
    spoken = {norm(x) for x in ctx.get("spoken", [])}
    lib = plistlib.load(open(LIBRARY, "rb"))
    seeds = [pair(s) for s in a.seed]
    drops = [pair(s) for s in a.drop]
    explain = [pair(s) for s in a.explain]

    seen, tracks = set(), []
    for t in lib["Tracks"].values():
        if t.get("Track Type") == "File" and "Location" in t and t["Location"] not in seen:
            seen.add(t["Location"])
            tracks.append(t)

    def non_energy_reason(t):
        """The rules that do not depend on AcousticBrainz data."""
        artist = norm(primary_artist(t.get("Artist") or t.get("Album Artist")))
        gen = t.get("Genre") or ""
        tags = genres.get(artist, "")
        if os.path.splitext(winpath(t))[1].lower() in VIDEO_EXT or "video" in (t.get("Kind") or "").lower():
            return "video"
        if artist in kids or KIDS_GENRE.search(gen) or KIDS_GENRE.search(tags):
            return "kids"
        if HOLIDAY.search(f"{t.get('Album', '')} {t.get('Name', '')} {gen}"):
            return "holiday"
        if artist in spoken:
            return "spoken"
        if (set(x.strip() for x in tags.split(";")) & CLASSICAL_TAGS) or CLASSICAL_GENRE.search(gen):
            return "classical"
        if (set(x.strip() for x in tags.split(";")) & JAZZ_TAGS) or re.search(r"jazz", gen, re.I):
            return "jazz"
        return None

    def decide(t):
        """(reason it was left out or None, features row or None)."""
        stars = 0 if t.get("Rating Computed") else t.get("Rating", 0) // 20
        f = feats.get(t["Persistent ID"])
        for d in drops:
            if matches(t, *d):
                return "dropped by you", f
        r = non_energy_reason(t)
        is_seed = any(matches(t, *s) for s in seeds)
        if stars < a.min_rating and not is_seed:
            return "rating", f
        if r:
            return r, f
        if is_seed:
            return None, f
        if not f:
            return "no data", f
        bpm, onset = float(f["bpm"]), float(f["onset"] or 0)
        if float(f["danceability"] or 0) < a.min_dance or onset < a.min_onset or bpm < a.min_bpm or onset * 60 / bpm < a.min_epb:
            return "calm", f
        return None, f

    chosen, reasons, nodata = [], collections.Counter(), []
    for t in tracks:
        r, f = decide(t)
        if r is None:
            chosen.append((t, f))
        else:
            reasons[r] += 1
            if r == "no data":
                nodata.append(t)

    print(f"{len(tracks)} songs in iTunes -> {len(chosen)} chosen")
    for k in ("rating", "video", "kids", "holiday", "spoken", "classical", "jazz", "no data", "calm", "dropped by you"):
        if reasons[k]:
            print(f"  left out by '{k}': {reasons[k]}")
    for s in seeds:
        hit = [t for t, _ in chosen if matches(t, *s)]
        print(f"  seed {s[0]} | {s[1]}: {'included' if hit else 'NOT in the list (not found, or excluded as video/kids/holiday...)'}")
    for e in explain:
        hits = [t for t in tracks if matches(t, *e)]
        if not hits:
            print(f"  explain {e[0]} | {e[1]}: not in the library")
        for t in hits[:3]:
            r, f = decide(t)
            fx = f"danceability {f['danceability']}, onset {f['onset']}, bpm {f['bpm']}" if f else "no AcousticBrainz data"
            print(f"  explain {t.get('Artist')} - {t.get('Name')}: {'IN' if r is None else 'out (' + r + ')'}  [{fx}]")

    if a.candidates:
        print()
        print("songs without AcousticBrainz data (rated enough, not excluded), most played first; add the ones you like with --seed:")
        for t in sorted(nodata, key=lambda t: -t.get("Play Count", 0))[:a.candidates]:
            print(f"   {t.get('Artist', '')[:26]:26} {t.get('Name', '')[:44]:44} {t.get('Play Count', 0):>3} plays  {(genres.get(norm(primary_artist(t.get('Artist') or '')), '') or '-')[:34]}")
    secs = sum(t.get("Total Time", 0) for t, _ in chosen) // 1000
    print(f"length: {secs // 3600} h {secs % 3600 // 60} min, {len(chosen)} songs")
    top = collections.Counter(primary_artist(t.get("Artist") or "") for t, _ in chosen).most_common(8)
    print("most represented artists:", ", ".join(f"{n} ({c})" for n, c in top))
    if a.show:
        print()
        print(f"{'artist - title':56} bpm  dance onset loud")
        for t, f in random.Random(5).sample(chosen, min(a.show, len(chosen))):
            m = (f"{float(f['bpm']):4.0f} {float(f['danceability']):5.2f} {float(f['onset']):4.1f} {float(f['loudness'] or 0):4.2f}" if f else "  (named by you, no measurements)")
            print(f"{(str(t.get('Artist', '')) + ' - ' + str(t.get('Name', '')))[:56]:56} {m}")
    if a.dry_run or not chosen:
        return
    random.Random(2026).shuffle(chosen)   # fixed shuffle: same list every run
    crlf = chr(13) + chr(10)
    lines = ["#EXTM3U"]
    for t, _ in chosen:
        lines.append(f"#EXTINF:{t.get('Total Time', 0) // 1000},{t.get('Artist', '')} - {t.get('Name', '')}")
        lines.append(winpath(t))
    out = os.path.join(ROOT, "playlists", f"[Gen] {a.name}.m3u8")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "wb") as f:
        f.write((crlf.join(lines) + crlf).encode("utf-8"))
    print("wrote", out)


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
