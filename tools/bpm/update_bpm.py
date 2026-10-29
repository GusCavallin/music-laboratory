"""Tempo (BPM) per track from AcousticBrainz, keyed by the MusicBrainz recording ID of the release-year index.

    py -3 update_bpm.py              # asks only about recordings not yet in bpm_cache.json, then rebuilds bpm.csv
    py -3 update_bpm.py --limit 500  # ask about at most 500 new recordings this run (it resumes where it stopped)
    py -3 update_bpm.py --no-fetch   # just rebuild bpm.csv from the cache

AcousticBrainz stopped collecting data in 2022 but its API still answers, so what it knows is what it will ever know:
the cache never needs refreshing for a recording that was looked up once (a miss is cached too). Roughly 4 in 10
recordings have a tempo. The tempo is computed by software from the audio, so a value can be double or half of the
real one. Where several submissions exist the median is used.

Reads:  tools/release-years/release_years.csv  (persistent_id, mb_recording_id)
Writes: bpm_cache.json (committed: costly to rebuild) and bpm.csv (derived, git-ignored)
"""
import csv, json, os, statistics, sys, time, urllib.error, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
YEARS = os.path.join(os.path.dirname(HERE), "release-years", "release_years.csv")
CACHE = os.path.join(HERE, "bpm_cache.json")
OUT = os.path.join(HERE, "bpm.csv")
API = "https://acousticbrainz.org/api/v1/low-level"
UA = {"User-Agent": "music-lab-bpm/1.0 (personal library tool)"}
BATCH = 25  # the bulk endpoint takes up to 25 recording IDs


def fetch(ids):
    """One bulk request, politely retried; returns {mbid: {offset: lowlevel-doc}} or None if it keeps failing."""
    url = API + "?recording_ids=" + ";".join(ids)
    for attempt in range(5):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
                return json.loads(r.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            if e.code not in (429, 500, 502, 503, 504):
                raise
        except (urllib.error.URLError, TimeoutError):
            pass
        time.sleep(5 * (attempt + 1))
    return None


def summarize(doc):
    """Median tempo, danceability, onset rate (note/beat events per second) and loudness over the submissions
    AcousticBrainz holds for one recording."""
    subs = [v for v in doc.values() if isinstance(v, dict) and isinstance(v.get("rhythm"), dict)]
    bpms = [v["rhythm"]["bpm"] for v in subs if v["rhythm"].get("bpm")]
    if not bpms:
        return {"bpm": None}
    med = lambda vals, nd: round(statistics.median(vals), nd) if vals else None
    return {"bpm": med(bpms, 1), "n": len(bpms),
            "danceability": med([v["rhythm"]["danceability"] for v in subs if v["rhythm"].get("danceability") is not None], 2),
            "onset": med([v["rhythm"]["onset_rate"] for v in subs if v["rhythm"].get("onset_rate") is not None], 2),
            "loudness": med([v["lowlevel"]["average_loudness"] for v in subs if isinstance(v.get("lowlevel"), dict) and v["lowlevel"].get("average_loudness") is not None], 2)}


def main():
    rows = [r for r in csv.DictReader(open(YEARS, encoding="utf-8-sig")) if r.get("mb_recording_id")]
    ids = list(dict.fromkeys(r["mb_recording_id"] for r in rows))
    cache = json.load(open(CACHE, encoding="utf-8")) if os.path.exists(CACHE) else {}
    limit = int(sys.argv[sys.argv.index("--limit") + 1]) if "--limit" in sys.argv else None
    # new recordings, plus ones cached before onset rate / loudness were kept (only those that have a tempo)
    todo = [i for i in ids if i not in cache or (cache[i].get("bpm") and "onset" not in cache[i])]
    if limit is not None:
        todo = todo[:limit]
    if "--no-fetch" in sys.argv:
        todo = []
    print(f"{len(rows)} tracks with a recording id, {len(ids)} distinct recordings, {len(cache)} already looked up, "
          f"{len(todo)} to ask about now ({-(-len(todo) // BATCH)} requests)")
    for n, start in enumerate(range(0, len(todo), BATCH), 1):
        batch = todo[start:start + BATCH]
        doc = fetch(batch)
        if doc is None:
            print("AcousticBrainz is not answering; stopping. Run again later to continue.")
            break
        for mbid in batch:
            cache[mbid] = summarize(doc[mbid]) if mbid in doc else {"bpm": None}
        json.dump(cache, open(CACHE, "w", encoding="utf-8"), indent=0)
        if n % 10 == 0 or start + BATCH >= len(todo):
            found = sum(1 for m in ids if cache.get(m, {}).get("bpm"))
            print(f"  request {n}: {len(cache)} looked up, {found} with a tempo so far", flush=True)
        time.sleep(1)  # one request per second
    with open(OUT, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(["persistent_id", "artist", "name", "mb_recording_id", "bpm", "danceability", "onset", "loudness"])
        have = 0
        for r in rows:
            c = cache.get(r["mb_recording_id"], {})
            if c.get("bpm"):
                have += 1
            w.writerow([r["persistent_id"], r["artist"], r["name"], r["mb_recording_id"], c.get("bpm") or "", c.get("danceability") or "", c.get("onset") or "", c.get("loudness") or ""])
    print(f"bpm.csv: {have} of {len(rows)} tracks have a tempo ({have / max(1, len(rows)):.0%})")


if __name__ == "__main__":
    main()
