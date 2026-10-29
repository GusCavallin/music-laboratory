"""Merges batches/*.csv (Claude's ratings) with poc_songs.csv into gems.json, keyed by iTunes Persistent ID.

    py -3 merge.py
Batch rows: idx, wonder, transcendence, tenderness, nostalgia, peacefulness, power, joyful, tension, sadness, maturity, confidence
(0-10 each; maturity is empty for instrumentals; confidence 1 = low, 2 = medium, 3 = high). Ratings are Claude's estimates of
what a typical listener feels, from knowing the songs (GEMS scales, Zentner et al. 2008); "maturity" is
the emotional maturity of the lyrics (ambivalence, responsibility, commitment as a choice, repair, acceptance, loss told honestly).
"""
import csv, glob, json, os
HERE = os.path.dirname(os.path.abspath(__file__))
SCALES = ["wonder", "transcendence", "tenderness", "nostalgia", "peacefulness", "power", "joyful", "tension", "sadness", "maturity"]
songs = {r["idx"]: r for r in csv.DictReader(open(os.path.join(HERE, "poc_songs.csv"), encoding="utf-8-sig"))}
out, bad = {}, []
for f in sorted(glob.glob(os.path.join(HERE, "batches", "b*.csv"))):
    for row in csv.reader(open(f, encoding="utf-8")):
        if not row:
            continue
        idx, vals = row[0], row[1:]
        if idx not in songs or len(vals) != 11:
            bad.append((os.path.basename(f), row))
            continue
        s = songs[idx]
        rec = {k: (int(v) if v != "" else None) for k, v in zip(SCALES, vals[:10])}
        rec.update(confidence=int(vals[10]), artist=s["artist"], name=s["name"], album=s["album"])
        out[s["persistent_id"]] = rec
tmp = os.path.join(HERE, "gems.json.tmp")  # write aside, then swap in: never leaves a half-written gems.json
with open(tmp, "w", encoding="utf-8") as fh:
    json.dump({"scale": "0-10", "scales": SCALES, "confidence": "1 low, 2 medium, 3 high", "by": "Claude (estimates)",
               "songs": out}, fh, ensure_ascii=False, indent=0)
os.replace(tmp, os.path.join(HERE, "gems.json"))
print(len(out), "songs rated;", len(bad), "bad rows", bad[:3])
