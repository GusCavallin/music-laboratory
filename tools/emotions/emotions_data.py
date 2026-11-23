"""Where the files of the Feel workflow are, and how they start.

The ratings are your own and stay out of git, so a fresh clone has none of these files. Every script here goes through this module, which
creates or tolerates what is missing, so the first run (queue some songs, rate them, merge) works from nothing:

    poc_songs.csv    the queue: one row per song waiting to be rated (idx, persistent_id, artist, name, album, secs); made with its header on first use
    batches/         the ratings, one CSV per batch (no header): idx, the ten scales, confidence; the folder is made on first use
    gems.json        every rating merged, keyed by the library's persistent id; written by merge.py (before the first merge there are no ratings)
    axes.json        the three Feel axes, written by axes.py once there are enough ratings (see MIN_SONGS in axes.py)
"""
import csv
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
POC = os.path.join(HERE, "poc_songs.csv")
GEMS = os.path.join(HERE, "gems.json")
BATCHES = os.path.join(HERE, "batches")
SCALES = ["wonder", "transcendence", "tenderness", "nostalgia", "peacefulness", "power", "joyful", "tension", "sadness", "maturity"]
POC_HEADER = ["idx", "persistent_id", "artist", "name", "album", "secs"]


def start():
    """Makes what a first run needs: the batches folder and the queue file with its header. Nothing that exists is touched."""
    os.makedirs(BATCHES, exist_ok=True)
    if not os.path.exists(POC):
        with open(POC, "w", encoding="utf-8-sig", newline="") as f:
            csv.writer(f).writerow(POC_HEADER)


def queue():
    """The rows of poc_songs.csv (a list of dicts); the file is made first when it does not exist yet."""
    start()
    with open(POC, encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def gems():
    """gems.json as a dict; before the first merge, an empty one (no rated songs)."""
    if not os.path.exists(GEMS):
        return {"scale": "0-10", "scales": SCALES, "confidence": "1 low, 2 medium, 3 high", "by": "an AI agent (estimates)", "songs": {}}
    with open(GEMS, encoding="utf-8") as f:
        return json.load(f)
