"""The first run of the Feel workflow, from nothing: a fresh clone has none of the data files (they are your own ratings and stay out of git).

    py -3 -m unittest test_first_run        (from this folder)

It builds a temporary repo-shaped folder with an invented library and runs the real scripts in it: queue a playlist, write a batch, merge,
queue again, and the scripts that need ratings or enough of them.
"""
import csv
import json
import os
import plistlib
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
SCRIPTS = ("emotions_data.py", "queue_playlist.py", "add_set.py", "merge.py", "axes.py", "correlations.py", "stats.py")


class FirstRun(unittest.TestCase):
    def setUp(self):
        self.root = Path(tempfile.mkdtemp(prefix="feel-first-run-"))
        self.emo = self.root / "tools" / "emotions"
        self.emo.mkdir(parents=True)
        shutil.copy(REPO / "musiclab_config.py", self.root / "musiclab_config.py")
        for name in SCRIPTS:
            shutil.copy(HERE / name, self.emo / name)
        tracks = {}
        for i, (name, artist, stars, loved) in enumerate([("Song A", "Artist X", 4, True), ("Song B", "Artist X", 4, True), ("Song C", "Artist Y", 3, False)], 1):
            tracks[str(i)] = {"Track ID": i, "Name": name, "Artist": artist, "Album": "Album", "Track Type": "File", "Persistent ID": f"{i:016X}",
                              "Total Time": 200000, "Rating": stars * 20, "Loved": loved, "Location": f"file://localhost/C:/music/{i}.mp3"}
        lib = {"Major Version": 1, "Minor Version": 1, "Tracks": tracks,
               "Playlists": [{"Name": "Mix", "Playlist ID": 1, "Playlist Persistent ID": "AAAA0001", "Playlist Items": [{"Track ID": 1}, {"Track ID": 2}, {"Track ID": 3}]}]}
        (self.root / "lib.xml").write_bytes(plistlib.dumps(lib))
        self.env = dict(os.environ, MUSICLAB_SOURCE_LIBRARY=str(self.root / "lib.xml"), PYTHONIOENCODING="utf-8")

    def tearDown(self):
        shutil.rmtree(self.root, ignore_errors=True)

    def run_script(self, *args):
        r = subprocess.run([sys.executable, *args], cwd=self.emo, env=self.env, capture_output=True, text=True, encoding="utf-8", timeout=60)
        return r.returncode, (r.stdout + r.stderr)

    def queue_rows(self):
        with open(self.emo / "poc_songs.csv", encoding="utf-8-sig", newline="") as f:
            return list(csv.DictReader(f))

    def test_nothing_exists_at_first(self):
        self.assertEqual(sorted(p.name for p in self.emo.iterdir()), sorted(SCRIPTS))

    def test_a_dry_run_makes_the_queue_and_lists_the_songs_without_adding_them(self):
        code, out = self.run_script("queue_playlist.py", "Mix", "--dry-run")
        self.assertEqual(code, 0, out)
        self.assertIn("3 not rated yet", out)
        self.assertEqual(self.queue_rows(), [])                 # the file has its header and no songs
        self.assertTrue((self.emo / "batches").is_dir())

    def test_queue_rate_merge_queue_again(self):
        code, out = self.run_script("queue_playlist.py", "Mix")
        self.assertEqual(code, 0, out)
        rows = self.queue_rows()
        self.assertEqual([r["idx"] for r in rows], ["0", "1", "2"])
        self.assertEqual(rows[0]["name"], "Song A")
        code, out = self.run_script("queue_playlist.py", "Mix")  # queued but not rated: the same idx again, no duplicate rows
        self.assertEqual(code, 0, out)
        self.assertEqual(len(self.queue_rows()), 3)

        (self.emo / "batches" / "b01.csv").write_text("0,6,5,7,4,8,2,3,2,5,6,3\n1,7,6,5,3,6,5,6,3,4,,2\n", encoding="utf-8")   # an agent's ratings (no header)
        code, out = self.run_script("merge.py")
        self.assertEqual(code, 0, out)
        self.assertIn("2 songs rated; 0 bad rows", out)
        gems = json.loads((self.emo / "gems.json").read_text(encoding="utf-8"))
        self.assertEqual(sorted(s["name"] for s in gems["songs"].values()), ["Song A", "Song B"])
        self.assertIsNone(gems["songs"]["0000000000000002"]["maturity"])   # empty maturity = instrumental

        code, out = self.run_script("queue_playlist.py", "Mix")  # what is rated is left alone
        self.assertIn("1 not rated yet", out)

    def test_add_set_works_from_nothing(self):
        code, out = self.run_script("add_set.py", "4")
        self.assertEqual(code, 0, out)
        self.assertEqual([r["name"] for r in self.queue_rows()], ["Song A", "Song B"])

    def test_merge_with_no_batches_is_not_an_error(self):
        code, out = self.run_script("merge.py")
        self.assertEqual(code, 0, out)
        self.assertIn("0 songs rated", out)

    def test_the_scripts_that_need_ratings_say_so_instead_of_crashing(self):
        for script in ("correlations.py", "stats.py"):
            code, out = self.run_script(script)
            self.assertNotEqual(code, 0, script)
            self.assertIn("No rated songs yet", out, script)
            self.assertNotIn("Traceback", out, script)

    def test_axes_wait_for_enough_ratings(self):
        self.run_script("queue_playlist.py", "Mix")
        (self.emo / "batches" / "b01.csv").write_text("0,6,5,7,4,8,2,3,2,5,6,3\n", encoding="utf-8")
        self.run_script("merge.py")
        code, out = self.run_script("axes.py")
        self.assertEqual(code, 0)   # too early is not an error
        self.assertIn("Only 1 rated songs: at least 100 are needed", out)
        self.assertIn("Nothing was written", out)
        self.assertNotIn("Traceback", out)
        self.assertFalse((self.emo / "axes.json").exists())


if __name__ == "__main__":
    unittest.main()
