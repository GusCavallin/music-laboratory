"""Tests for server.py of the React page: when it builds the page, and that it serves dist\\ on its own port. Standard library only.

    py -3 -m unittest test_server        (in this folder; nothing of yours is read or changed)
"""
import os
import sys
import tempfile
import time
import unittest
from pathlib import Path
from unittest import mock

HERE = Path(__file__).resolve().parent
os.environ.setdefault("MUSICLAB_SOURCE_LIBRARY", str(Path(__file__).resolve()))  # importing the helper wants a library path that exists; these tests read no library
sys.path.insert(0, str(HERE))
import server  # noqa: E402


def touch(path, when):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("x")
    os.utime(path, (when, when))


class BuildNeeded(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        now = time.time()
        self.old, self.mid, self.new = now - 300, now - 200, now - 100
        for rel in ("src/App.tsx", "src/data/load.ts", "public/sw.js", "index.html", "package.json"):
            touch(self.root / rel, self.old)
        touch(self.root / "dist" / "index.html", self.mid)

    def tearDown(self):
        self.tmp.cleanup()

    def test_a_current_build_is_left_alone(self):
        self.assertFalse(server.build_needed(self.root))

    def test_no_build_means_build(self):
        (self.root / "dist" / "index.html").unlink()
        self.assertTrue(server.build_needed(self.root))

    def test_a_changed_source_file_means_build(self):
        for rel in ("src/data/load.ts", "public/sw.js", "index.html", "package.json"):
            with self.subTest(rel):
                touch(self.root / rel, self.new)
                self.assertTrue(server.build_needed(self.root))
                touch(self.root / rel, self.old)
                self.assertFalse(server.build_needed(self.root))

    def test_a_new_source_file_means_build(self):
        touch(self.root / "src" / "feel" / "new.ts", self.new)
        self.assertTrue(server.build_needed(self.root))

    def test_what_is_not_built_from_is_ignored(self):
        for rel in ("node_modules/x/index.js", "README.md", "server.py", "dist/assets/app.js"):
            touch(self.root / rel, self.new)
        self.assertFalse(server.build_needed(self.root))


class Build(unittest.TestCase):
    def test_without_node_modules_it_says_to_install_and_does_not_run_npm(self):
        with tempfile.TemporaryDirectory() as tmp, mock.patch("subprocess.run") as run:
            self.assertFalse(server.build(Path(tmp)))
            run.assert_not_called()

    def test_a_failed_build_is_reported(self):
        with tempfile.TemporaryDirectory() as tmp, mock.patch("subprocess.run", return_value=mock.Mock(returncode=1)):
            (Path(tmp) / "node_modules").mkdir()
            self.assertFalse(server.build(tmp))

    def test_a_good_build_is_reported(self):
        with tempfile.TemporaryDirectory() as tmp, mock.patch("subprocess.run", return_value=mock.Mock(returncode=0)) as run:
            (Path(tmp) / "node_modules").mkdir()
            self.assertTrue(server.build(tmp))
            self.assertEqual(run.call_args.args[0], ["npm", "run", "build"])

    def test_no_npm_is_reported(self):
        with tempfile.TemporaryDirectory() as tmp, mock.patch("subprocess.run", side_effect=FileNotFoundError):
            (Path(tmp) / "node_modules").mkdir()
            self.assertFalse(server.build(tmp))


class Identity(unittest.TestCase):
    def test_its_own_port_and_name_so_it_runs_beside_the_current_page(self):
        self.assertEqual((server.PORT, server.SIGNATURE), (9223, "music-hub-react"))
        self.assertNotEqual(server.SIGNATURE, "music-library-search")

    def test_the_page_names_the_helper_the_page_checks_for(self):
        ts = (HERE / "src" / "api" / "helper.ts").read_text(encoding="utf-8")
        self.assertIn(f'"{server.SIGNATURE}"', ts)

    def test_the_dev_server_reaches_this_helper_by_default(self):
        cfg = (HERE / "vite.config.ts").read_text(encoding="utf-8")
        self.assertIn(f"http://127.0.0.1:{server.PORT}", cfg)

    def test_the_installable_files_are_there(self):
        for name in ("manifest.webmanifest", "sw.js", "icon-192.png", "icon-512.png"):
            self.assertTrue((HERE / "public" / name).is_file(), name)


if __name__ == "__main__":
    unittest.main()
