"""Machine-specific settings for the music-lab tools, read from config.json at the repo root.

Copy config.example.json to config.json and fill it in (config.json is git-ignored, so your paths stay on your machine):

    source_music_library   the music library file the tools read (an Apple property list, the "XML" a music player exports). Read-only.
    cd_archive_index       optional; a spreadsheet (.xlsx) indexing MP3s burned on CDs, for the archive tab of Music Hub. Without it the tab is empty.
    contact_email          optional; only sent to MusicBrainz in the User-Agent of the lookups (update_index.py asks for it when needed)

Paths may use forward slashes (C:/Music/Library.xml) or doubled backslashes. An environment variable overrides the file:
MUSICLAB_SOURCE_LIBRARY, MUSICLAB_CD_ARCHIVE_INDEX, MUSICLAB_CONTACT_EMAIL.

A script uses it like this (from tools/<name>/ or games/<name>/):

    import pathlib, sys
    sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2]))
    from musiclab_config import SOURCE_LIBRARY
"""
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CONFIG_FILE = ROOT / "config.json"


def _settings():
    try:
        data = json.loads(CONFIG_FILE.read_text(encoding="utf-8-sig"))
    except FileNotFoundError:
        return {}
    except ValueError as e:
        sys.exit(f"music-lab: {CONFIG_FILE} is not valid JSON ({e}). In paths, use forward slashes or doubled backslashes.")
    return data if isinstance(data, dict) else {}


def setting(key, env=None, required=True):
    """The value of `key` from the environment variable `env` (first) or config.json; exits with a hint when it is required and missing."""
    value = (os.environ.get(env) if env else None) or _settings().get(key)
    if not value:
        if required:
            sys.exit(f"music-lab: '{key}' is not set. Copy config.example.json to config.json (in {ROOT}) and fill it in.")
        return None
    return os.path.expandvars(os.path.expanduser(str(value)))


def source_music_library():
    path = setting("source_music_library", "MUSICLAB_SOURCE_LIBRARY")
    if not os.path.isfile(path):
        sys.exit(f"music-lab: source_music_library points to a file that does not exist: {path}\nEdit {CONFIG_FILE}.")
    return path


def cd_archive_index():
    """The CD archive spreadsheet, or None when none is configured (it is optional)."""
    path = setting("cd_archive_index", "MUSICLAB_CD_ARCHIVE_INDEX", required=False)
    if path and not os.path.isfile(path):
        sys.exit(f"music-lab: cd_archive_index points to a file that does not exist: {path}\nEdit {CONFIG_FILE}, or remove that line.")
    return path


SOURCE_LIBRARY = source_music_library()
CD_ARCHIVE_INDEX = cd_archive_index()
CONTACT_EMAIL = setting("contact_email", "MUSICLAB_CONTACT_EMAIL", required=False)
