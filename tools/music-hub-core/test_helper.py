"""Tests for the shared helper (helper.py) and the data script, on an invented library: nothing of yours is read or changed.

    py -3 -m unittest test_helper -v          (from this folder)

It copies the real helper, build_data.py and the vanilla page's launcher into a temporary repo-shaped folder, adds a second "page" that
is served as a whole folder (like a built React app), starts the helpers on spare ports, and checks the routes, what is NOT served,
that two pages' helpers can run at once without mistaking each other, and that the old `build_data.py` in tools/music-hub still works.
iTunes is replaced by a stub script that only says what the real one would be asked to do.
"""
import http.client
import json
import math
import os
import plistlib
import shutil
import socket
import struct
import subprocess
import sys
import tempfile
import time
import unittest
import wave
from pathlib import Path

CORE = Path(__file__).resolve().parent
TOOLS = CORE.parent
REPO = TOOLS.parent
PY = sys.executable


def free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def tone(path, hz):
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(8000)
        w.writeframes(b"".join(struct.pack("<h", int(8000 * math.sin(2 * math.pi * hz * i / 8000))) for i in range(1600)))


def request(port, path, method="GET", body=None, headers=None):
    c = http.client.HTTPConnection("127.0.0.1", port, timeout=5)
    h = {"Host": f"127.0.0.1:{port}"}
    if body is not None:
        h["Content-Type"] = "application/json"
        h["Origin"] = f"http://127.0.0.1:{port}"
    h.update(headers or {})
    c.request(method, path, body=json.dumps(body) if body is not None else None, headers=h)
    r = c.getresponse()
    return r.status, r.getheader("Content-Type") or "", r.read()


class Tree:
    """A repo-shaped temporary folder with an invented library, and the helpers started from it."""

    def __init__(self):
        self.root = Path(tempfile.mkdtemp(prefix="musichub-test-"))
        self.procs = []
        t = self.root / "tools"
        shutil.copy(REPO / "musiclab_config.py", self.root / "musiclab_config.py")
        (self.root / "VERSION").write_text("9.9.9\n")
        (self.root / "playlists" / "bak").mkdir(parents=True)
        core = t / "music-hub-core"
        core.mkdir(parents=True)
        for name in ("helper.py", "build_data.py"):
            shutil.copy(CORE / name, core / name)  # (mojibake_fixes.json is optional and not needed here)
        vanilla = t / "music-hub"
        vanilla.mkdir()
        for name in ("server.py", "build_data.py", "index.html", "sw.js", "manifest.webmanifest", "icon-192.png", "icon-512.png"):
            shutil.copy(TOOLS / "music-hub" / name, vanilla / name)
        (vanilla / "secret.txt").write_text("not for the browser")
        app = t / "built-app"  # a page served as a whole folder, like a built React app
        (app / "assets").mkdir(parents=True)
        (app / "index.html").write_text("<!doctype html><title>built app</title>")
        (app / "assets" / "app-1a2b3c.js").write_text("console.log(1)")
        (app / "assets" / "style-9z.css").write_text("body{}")
        (app / "server.py").write_text(
            "import os, sys\nsys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'music-hub-core'))\n"
            "import helper\nhelper.run(os.path.dirname(os.path.abspath(__file__)), port=9123, signature='built-app-test')\n")
        (t / "itunes-com").mkdir()
        (t / "itunes-com" / "rate_file.ps1").write_text(
            'param([string]$Path,[string]$Name,[int]$Stars,[string]$FromPlaylist="")\n'
            'if ($FromPlaylist -ne "") { "OK $Stars REMOVED" } else { "OK $Stars" }\n', encoding="utf-8")
        music = self.root / "music"
        music.mkdir()
        tracks = {}
        self.songs = []
        for i, name in enumerate(["Tone A", "Tone B"], 1):
            f = music / f"{i:02d} {name}.wav"
            tone(f, 220 * i)
            self.songs.append(str(f))
            tracks[str(i)] = {"Track ID": i, "Name": name, "Artist": "Artist", "Album": "Album", "Genre": "Test", "Kind": "WAV audio file",
                              "Total Time": 200, "Rating": 60, "Play Count": i, "Track Type": "File", "Persistent ID": f"{i:016X}",
                              "Location": f.resolve().as_uri().replace("file:///", "file://localhost/")}
        lib = {"Major Version": 1, "Minor Version": 1, "Tracks": tracks,
               "Playlists": [{"Name": "Mix", "Playlist ID": 1, "Playlist Persistent ID": "AAAA0001", "Playlist Items": [{"Track ID": 1}]}]}
        (self.root / "lib.xml").write_bytes(plistlib.dumps(lib))
        self.env = dict(os.environ, MUSICLAB_SOURCE_LIBRARY=str(self.root / "lib.xml"), PYTHONIOENCODING="utf-8", PYTHONUNBUFFERED="1")
        self.env.pop("MUSICLAB_CD_ARCHIVE_INDEX", None)
        self.env.pop("LIBRARY_SEARCH_PORT", None)

    def build_with_old_script(self):
        """The data is built the way the public README says: py -3 build_data.py in tools/music-hub (now a forwarder)."""
        r = subprocess.run([PY, "build_data.py"], cwd=self.root / "tools" / "music-hub", env=self.env, capture_output=True, text=True, timeout=60)
        return r

    def start(self, page, port):
        folder = {"vanilla": "music-hub", "app": "built-app"}[page]
        p = subprocess.Popen([PY, "server.py", "--port", str(port), "--no-browser", "--keep-alive"], cwd=self.root / "tools" / folder,
                             env=self.env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
        self.procs.append(p)
        return p

    def wait_for(self, port):
        for _ in range(100):
            try:
                return request(port, "/ping")[2].decode()
            except OSError:
                time.sleep(0.1)
        raise AssertionError(f"nothing answered on {port}")

    def close(self):
        for p in self.procs:
            p.kill()
            p.communicate()
        shutil.rmtree(self.root, ignore_errors=True)


class HelperTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.t = Tree()
        r = cls.t.build_with_old_script()
        cls.build = r
        cls.vp, cls.ap = free_port(), free_port()
        while abs(cls.vp - cls.ap) < 5:  # the helper looks at the next ports when its own is busy: keep the two pages' ranges apart
            cls.ap = free_port()
        cls.vanilla = cls.t.start("vanilla", cls.vp)
        cls.app = cls.t.start("app", cls.ap)
        cls.vsig = cls.t.wait_for(cls.vp)
        cls.asig = cls.t.wait_for(cls.ap)

    @classmethod
    def tearDownClass(cls):
        cls.t.close()

    def test_the_old_build_data_script_still_builds_data_js_in_the_core_folder(self):
        self.assertEqual(self.build.returncode, 0, self.build.stdout + self.build.stderr)
        self.assertIn("iTunes tracks: 2", self.build.stdout)
        data = self.t.root / "tools" / "music-hub-core" / "data.js"
        self.assertTrue(data.exists())
        self.assertFalse((self.t.root / "tools" / "music-hub" / "data.js").exists(), "data.js must not appear in the page's folder")
        lib = json.loads(data.read_text(encoding="utf-8")[len("window.LIB = "):].rstrip().rstrip(";"))
        self.assertEqual(lib["version"], "9.9.9")

    def test_each_page_answers_with_its_own_signature(self):
        self.assertEqual(self.vsig, "music-library-search")
        self.assertEqual(self.asig, "built-app-test")

    def test_the_vanilla_page_serves_its_files_and_the_shared_data(self):
        for path, kind in [("/", "text/html"), ("/index.html", "text/html"), ("/sw.js", "text/javascript"),
                           ("/manifest.webmanifest", "application/manifest+json"), ("/icon-192.png", "image/png"),
                           ("/icon-512.png", "image/png"), ("/data.js", "text/javascript")]:
            status, ctype, body = request(self.vp, path)
            self.assertEqual(status, 200, path)
            self.assertTrue(ctype.startswith(kind), f"{path}: {ctype}")
            self.assertTrue(body, path)
        self.assertEqual(request(self.vp, "/")[2], (self.t.root / "tools" / "music-hub" / "index.html").read_bytes())

    def test_the_vanilla_page_serves_only_its_listed_files(self):
        for path in ["/server.py", "/build_data.py", "/secret.txt", "/presets.json", "/helper.py", "/../music-hub-core/helper.py",
                     "/../../musiclab_config.py", "/%2e%2e/%2e%2e/musiclab_config.py"]:
            self.assertEqual(request(self.vp, path)[0], 404, path)

    def test_a_folder_page_serves_everything_in_it_and_nothing_outside(self):
        status, ctype, body = request(self.ap, "/assets/app-1a2b3c.js")
        self.assertEqual((status, body), (200, b"console.log(1)"))
        self.assertTrue(ctype.startswith("text/javascript"), ctype)
        self.assertTrue(request(self.ap, "/assets/style-9z.css")[1].startswith("text/css"))
        self.assertIn(b"built app", request(self.ap, "/")[2])
        self.assertEqual(request(self.ap, "/data.js")[0], 200)
        for path in ["/../music-hub/index.html", "/../../musiclab_config.py", "/%2e%2e/music-hub/index.html", "/assets/", "/nothing.js",
                     "/C:/Windows/win.ini"]:
            self.assertEqual(request(self.ap, path)[0], 404, path)

    def test_both_pages_share_the_data_and_the_presets(self):
        self.assertEqual(request(self.vp, "/data.js")[2], request(self.ap, "/data.js")[2])
        self.assertEqual(json.loads(request(self.vp, "/presets")[2]), {"presets": []})
        body = {"presets": [{"name": "Calm", "state": {"q": "x"}}]}
        self.assertEqual(request(self.vp, "/presets", "POST", body)[0], 200)
        self.assertEqual(json.loads(request(self.ap, "/presets")[2]), body)
        self.assertTrue((self.t.root / "tools" / "music-hub-core" / "presets.json").exists())
        self.assertEqual(request(self.ap, "/presets", "POST", {"presets": []})[0], 200)

    def test_saved_views_from_the_old_place_are_copied_once(self):
        t = Tree()
        try:
            old = t.root / "tools" / "music-hub" / "presets.json"
            old.write_text(json.dumps({"presets": [{"name": "Old", "state": {}}]}), encoding="utf-8")
            port = free_port()
            t.start("vanilla", port)
            t.wait_for(port)
            self.assertEqual(json.loads(request(port, "/presets")[2])["presets"][0]["name"], "Old")
            self.assertTrue(old.exists(), "the old file is left alone")
            self.assertTrue((t.root / "tools" / "music-hub-core" / "presets.json").exists())
        finally:
            t.close()

    def test_audio_streams_listed_songs_with_ranges_to_both_pages(self):
        from urllib.parse import quote
        song = quote(self.t.songs[0], safe="")
        for port in (self.vp, self.ap):
            status, _, body = request(port, f"/audio?p={song}", headers={"Range": "bytes=0-99"})
            self.assertEqual((status, len(body)), (206, 100))
            self.assertEqual(request(port, f"/audio?p={quote(str(self.t.root / 'lib.xml'), safe='')}")[0], 404)

    @unittest.skipUnless(os.name == "nt", "the iTunes stub is a PowerShell script")
    def test_rating_goes_through_the_stub_for_listed_songs_only(self):
        ok = request(self.ap, "/rate", "POST", {"path": self.t.songs[0], "name": "Tone A", "stars": 4})
        self.assertEqual(json.loads(ok[2])["ok"], True)
        self.assertEqual(json.loads(ok[2])["stars"], 4)
        bad = request(self.ap, "/rate", "POST", {"path": str(self.t.root / "lib.xml"), "name": "x", "stars": 4})
        self.assertEqual(bad[0], 400)

    def test_a_request_for_another_host_or_origin_is_refused(self):
        self.assertEqual(request(self.vp, "/ping", headers={"Host": "evil.example"})[0], 403)
        self.assertEqual(request(self.vp, "/presets", "POST", {"presets": []}, headers={"Origin": "http://evil.example"})[0], 403)

    def test_rebuild_runs_the_shared_script(self):
        status, _, body = request(self.vp, "/rebuild", "POST", {})
        self.assertEqual(status, 200)
        self.assertTrue(json.loads(body)["ok"], body)

    def test_a_second_launch_of_the_same_page_just_says_it_is_running(self):
        r = subprocess.run([PY, "server.py", "--port", str(self.vp), "--no-browser", "--keep-alive"],
                           cwd=self.t.root / "tools" / "music-hub", env=self.t.env, capture_output=True, text=True, timeout=20)
        self.assertIn("already running", r.stdout)

    def test_a_page_does_not_mistake_another_pages_helper_for_its_own(self):
        """The folder page asked for the vanilla page's port: it must take the next free port, not 'already running' there."""
        p = self.t.start("app", self.vp)
        line = ""
        for _ in range(60):
            line = p.stdout.readline()
            if "running at" in line or "already running" in line:
                break
        self.assertIn("running at", line)
        self.assertNotIn("already running", line)
        self.assertNotIn(f":{self.vp}/", line)
        port = int(line.rsplit(":", 1)[1].strip().strip("/"))
        self.assertEqual(self.t.wait_for(port), "built-app-test")
        self.assertEqual(request(self.vp, "/ping")[2].decode(), "music-library-search")  # the vanilla helper is untouched


if __name__ == "__main__":
    unittest.main()
