"""Genre (and country) per artist, from MusicBrainz community votes, cached.

    python update_genres.py              # look up only artists not yet cached, then rebuild the CSV
    python update_genres.py --dry-run    # report how many lookups are pending
    python update_genres.py --all        # include artists with no 3+ star / loved track
    python update_genres.py --retry-nomatch
    python update_genres.py --retry-ambiguous   # re-check shared names that couldn't be confirmed

Scope (default): artists with at least one track rated 3+ stars by hand (not album-inherited) or Loved.
Uses ../release-years/release_years.csv to skip classical, podcasts and no-artist tracks.

Files:
    artist_cache.json   MusicBrainz results keyed by normalized artist name -- never discard
    mb_genres.txt       MusicBrainz's official genre list (separates genres from tags like "british")
    artist_genres.csv   one row per artist in scope, rebuilt every run
"""
import argparse, collections, csv, datetime, os, plistlib, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "release-years"))
from update_index import (LIBRARY, load_json, lucene, mb_get, mb_search, norm,  # noqa: E402
                          primary_artist, same, save_json, strip_subtitle)

CACHE = os.path.join(HERE, "artist_cache.json")
GENRES = os.path.join(HERE, "mb_genres.txt")
OUT = os.path.join(HERE, "artist_genres.csv")
YEARS = os.path.join(HERE, "..", "release-years", "release_years.csv")
JUNK_TAG_GENRES = {"", "other", "misc", "unknown", "genre", "general", "default"}


def genre_list():
    if not os.path.exists(GENRES):
        txt = mb_get("genre/all?fmt=txt")
        open(GENRES, "w", encoding="utf-8").write(txt)
    return {g.strip().lower() for g in open(GENRES, encoding="utf-8") if g.strip()}


def confirm_by_songs(name, titles, candidates):
    """Several artists share the name: keep the one credited on our own songs. Returns an id or None."""
    ids = {a["id"] for a in candidates}
    hits = collections.Counter()
    for title in titles[:2]:
        res = mb_search(f'recording:"{lucene(strip_subtitle(title))}" AND artist:"{lucene(name)}"', limit=25)
        for r in res.get("recordings", []):
            if same(strip_subtitle(r.get("title", ""))) != same(strip_subtitle(title)):
                continue
            for c in r.get("artist-credit", []):
                aid = isinstance(c, dict) and c.get("artist", {}).get("id")
                if aid in ids:
                    hits[aid] += 1
        if hits:
            break
    return hits.most_common(1)[0][0] if hits else None


def lookup(name, genres, titles=()):
    # MusicBrainz often drops a leading "The" and knows artists by aliases (other spellings)
    names = [name] + ([name[4:]] if name.lower().startswith("the ") else [])
    res = mb_search(" OR ".join(f'artist:"{lucene(n)}" OR alias:"{lucene(n)}"' for n in names),
                    entity="artist", limit=10)
    target = same(name[4:] if name.lower().startswith("the ") else name)

    def names(a):
        out = {same(a.get("name")), same(a.get("sort-name"))}
        out |= {same(x.get("name")) for x in a.get("aliases", []) or []}
        return {n[4:] if n.startswith("the ") else n for n in out}

    exact = [a for a in res.get("artists", []) if target in names(a)]
    if not exact:
        return {"match": "none"}
    match = "exact"
    if len(exact) > 1:
        chosen = confirm_by_songs(name, list(titles), exact)
        if chosen:
            match = "confirmed"
            exact.sort(key=lambda a: a["id"] != chosen)
        else:  # no song evidence: guess the best-known one (most genre votes)
            match = "ambiguous"
            exact.sort(key=lambda a: -sum(t["count"] for t in a.get("tags", [])))
    a = exact[0]
    tags = sorted(a.get("tags", []), key=lambda t: -t["count"])
    return {
        "match": match,
        "mbid": a["id"], "name": a.get("name"), "disambiguation": a.get("disambiguation", ""),
        "type": a.get("type", ""), "country": a.get("country", ""),
        "area": (a.get("area") or {}).get("name", ""),
        "genres": [[t["name"], t["count"]] for t in tags if t["name"].lower() in genres and t["count"] > 0],
        "other_tags": [[t["name"], t["count"]] for t in tags if t["name"].lower() not in genres and t["count"] > 0],
        "alternatives": len(exact) - 1,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--retry-nomatch", action="store_true")
    ap.add_argument("--retry-ambiguous", action="store_true")
    args = ap.parse_args()

    kind = {r["persistent_id"]: r["kind"] for r in csv.DictReader(open(YEARS, encoding="utf-8-sig"))}
    lib = plistlib.load(open(LIBRARY, "rb"))
    seen, arts = set(), collections.defaultdict(list)
    for t in lib["Tracks"].values():
        if t.get("Track Type") != "File" or "Location" not in t or t["Location"] in seen:
            continue
        seen.add(t["Location"])
        if kind.get(t["Persistent ID"]) == "music":
            arts[primary_artist(t.get("Artist") or t.get("Album Artist"))].append(t)

    def liked(t):
        return t.get("Loved") or (not t.get("Rating Computed") and t.get("Rating", 0) >= 60)

    scope = {a: ts for a, ts in arts.items() if args.all or any(liked(t) for t in ts)}
    cache = load_json(CACHE)
    pending = sorted((a for a in scope if norm(a) not in cache
                      or (args.retry_nomatch and cache[norm(a)].get("match") == "none")
                      or (args.retry_ambiguous and cache[norm(a)].get("match") == "ambiguous")),
                     key=lambda a: -len(scope[a]))
    print(f"{len(arts)} artists, {len(scope)} in scope, {len(cache)} cached, {len(pending)} lookups pending", flush=True)
    if args.dry_run:
        return

    genres = genre_list()
    try:
        for n, a in enumerate(pending, 1):
            try:
                # the artist's best-liked songs, used to tell namesakes apart
                ts = sorted(scope[a], key=lambda t: (not liked(t), -t.get("Play Count", 0)))
                r = lookup(a, genres, [t.get("Name", "") for t in ts])
            except Exception as e:
                print(f"  ! {a}: {e}", flush=True)
                continue
            r["fetched"] = datetime.date.today().isoformat()
            cache[norm(a)] = r
            if n % 25 == 0:
                save_json(CACHE, cache)
                print(f"  {n}/{len(pending)} looked up", flush=True)
    finally:
        save_json(CACHE, cache)

    with open(OUT, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(["artist", "tracks", "liked_tracks", "mb_name", "disambiguation", "country", "area",
                    "genres", "source", "confidence", "itunes_genres", "mbid"])
        for a, ts in sorted(scope.items(), key=lambda x: -len(x[1])):
            c = cache.get(norm(a), {})
            tagc = collections.Counter(t.get("Genre", "") for t in ts if (t.get("Genre") or "").lower() not in JUNK_TAG_GENRES)
            itunes = "; ".join(g for g, _ in tagc.most_common(3))
            mbg = c.get("genres", [])
            if mbg:
                top = mbg[0][1]
                # keep genres with a meaningful share of the votes, max 5
                g = "; ".join(x for x, cnt in mbg if cnt >= max(1, top * 0.25))
                g = "; ".join(g.split("; ")[:5])
                votes = sum(cnt for _, cnt in mbg)
                sure = c["match"] in ("exact", "confirmed")
                conf = "high" if sure and votes >= 5 else "medium" if sure else "low"
                src = "musicbrainz"
            else:
                g, src, conf = (itunes.lower(), "itunes-tag", "low") if itunes else ("", "", "")
            w.writerow([a, len(ts), sum(1 for t in ts if liked(t)), c.get("name", ""), c.get("disambiguation", ""),
                        c.get("country", ""), c.get("area", ""), g, src, conf, itunes, c.get("mbid", "")])
    print(f"written: {OUT}", flush=True)


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
