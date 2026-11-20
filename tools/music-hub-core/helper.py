"""The helper shared by the Music Hub pages (standard library only).

Each page (tools/music-hub, tools/music-hub-react) has a small server.py that calls run(); everything else is here, once:
data.js and presets.json live next to this file, so every page reads the same library and the same saved views.

    run(app_dir, files=None, port=9123, signature="music-library-search")
        app_dir    the folder of the page's own files (index.html, ...). "/" is its index.html.
        files      None: any file under app_dir is served (a built app with hashed assets). A list of names: only those (the page's
                   folder also holds scripts that must not be served).
        port       the preferred port; each page has its own, so two pages can run at once.
        signature  what /ping answers, so a second launch recognises a running helper of the SAME page (and not another page's).

The page's server.py is started as:
    python server.py [--port N] [--browser chrome|edge] [--tab] [--no-browser] [--keep-alive]   # or double-click its serve.bat
    Ctrl+C / close the window to stop

Serves on http://127.0.0.1:<port> (or --port N / LIBRARY_SEARCH_PORT) only, this computer. If the port is busy it
takes the next free one; if our own helper is already there it just opens the window again.
    /presence         kept open by each page; when the last one closes the helper stops itself
                      (a few seconds of grace for reloads; --keep-alive turns this off)
    /ping             answers the signature so a second launch can recognise a running helper
    /version          {"version": "0.3.0"} from the VERSION file, read each time (the About box; data.js only has the one it was built with)
    /                 the page's index.html, its other app files, and data.js (never cached)
    POST /rebuild     runs build_data (in-process), then the page swaps in the new data.js
    GET/POST /presets saved views (presets.json): the page reads the list and writes it back whole
    POST /rate        sets one song's star rating in the running iTunes (tools/itunes-com/rate_file.ps1); for a [To Rate] playlist it also
                      removes the song from that playlist. Only songs listed in data.js are accepted.
    POST /playlist    writes the songs the page shows as "[Gen] <name>.m3u8" in the repo's playlists folder (Save as playlist); the user imports it
    /audio?p=<path>   streams a song (with Range, so seeking works). Only files whose path is listed in
                      data.js are served, so nothing else on the disk is reachable.
Read-only on the iTunes library file and the media files; the only changes it makes in iTunes are the ones /rate does
(/playlist only writes a file in this repo).
"""
import contextlib, http.client, io, json, mimetypes, os, re, select, shutil, socket, subprocess, sys, threading, time, webbrowser
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import build_data  # noqa: E402


def name_and_version():
    """"Music Hub 0.1.0", from the VERSION file at the repo root; plain "Music Hub" before the first release."""
    v = build_data.VERSION.read_text(encoding="utf-8").strip() if build_data.VERSION.exists() else ""
    return f"Music Hub {v}" if v else "Music Hub"


PORT = 9123 # preferred; if it is busy, main() reuses our own server there or takes the next free port
SIGNATURE = "music-library-search"
HOSTS = {f"127.0.0.1:{PORT}", f"localhost:{PORT}"}
HTML, JS = "text/html; charset=utf-8", "text/javascript; charset=utf-8"
APP_DIR, FILES = HERE, None  # the page's folder and which of its files may be served (set by run(); None = any file under APP_DIR)
TYPES = {".html": HTML, ".js": JS, ".mjs": JS, ".css": "text/css; charset=utf-8", ".json": "application/json", ".svg": "image/svg+xml",
         ".webmanifest": "application/manifest+json", ".png": "image/png", ".ico": "image/x-icon", ".map": "application/json",
         ".woff2": "font/woff2", ".txt": "text/plain; charset=utf-8"}


def static_file(url_path):
    """(file, content type) for a page file, or None. data.js is the library's, from this folder; the rest is from APP_DIR."""
    if url_path == "/data.js":
        return os.path.join(HERE, "data.js"), JS
    name = "index.html" if url_path in ("/", "/index.html") else url_path.lstrip("/")
    if FILES is not None and name not in FILES:
        return None
    root = os.path.realpath(APP_DIR)
    full = os.path.realpath(os.path.join(root, name))
    try:
        inside = os.path.commonpath([root, full]) == root
    except ValueError:  # another drive (a path like /D:/x)
        inside = False
    if not inside or not os.path.isfile(full):  # nothing outside the page's folder, whatever the path says
        return None
    return full, TYPES.get(os.path.splitext(full)[1].lower()) or mimetypes.guess_type(full)[0] or "application/octet-stream"


rebuild_lock = threading.Lock()
PRESETS = os.path.join(HERE, "presets.json")  # saved views of the page (Presets menu), shared by the pages
OLD_PRESETS = os.path.join(HERE, "..", "music-hub", "presets.json")  # where they were kept before this folder existed


def migrate_presets():
    """The saved views used to live in tools/music-hub: copy them here once (the old file is left alone)."""
    if not os.path.exists(PRESETS) and os.path.isfile(OLD_PRESETS):
        try:
            shutil.copyfile(OLD_PRESETS, PRESETS)
            print("Copied your saved views from tools/music-hub/presets.json to tools/music-hub-core/presets.json.", flush=True)
        except OSError:
            pass



TAG = "[To Rate]"  # rating a song while a playlist with this tag in its name is selected also removes it from that playlist
PLAYLISTS = os.path.normpath(os.path.join(HERE, "..", "..", "playlists"))  # where /playlist writes; the user imports the file into iTunes
GEN = "[Gen] "  # prefix of every generated playlist (agents/WRITING-PLAYLISTS.md)

# --- presence: each open page holds one /presence stream; when the last stream drops (window closed or crashed)
# the helper stops, unless --keep-alive. The browser itself closes the stream, so no unload events or timers needed. ---
KEEP_ALIVE = False
GRACE = 4  # seconds to wait once no page is connected: a reload drops the stream and reopens it a moment later
open_streams, ever_seen, presence_lock, SRV = 0, False, threading.Lock(), None


def watchdog():
    """Stops the helper once pages have connected and none has been connected for GRACE seconds."""
    empty_since = None
    while True:
        time.sleep(1)
        if KEEP_ALIVE or SRV is None:
            continue
        with presence_lock:
            gone = ever_seen and open_streams == 0
        if not gone:
            empty_since = None
        elif empty_since is None:
            empty_since = time.time()
        elif time.time() - empty_since >= GRACE:
            print("All windows closed: stopping the helper.", flush=True)
            SRV.shutdown()
            return


allowed = set()


def load_allowed():
    """Song paths listed in data.js (lower-cased: Windows paths are case-insensitive)."""
    global allowed
    try:
        text = open(os.path.join(HERE, "data.js"), encoding="utf-8").read()
        lib = json.loads(text[len("window.LIB = "):].rstrip().rstrip(";"))
        allowed = {os.path.normcase(r[-1]) for r in lib["itunes"]}
    except (OSError, ValueError, KeyError):
        allowed = set()


class Handler(BaseHTTPRequestHandler):
    server_version = "LibrarySearch"

    def log_message(self, fmt, *args):
        sys.stderr.write("%s %s\n" % (self.command, self.path.split("?")[0]))

    def send_text(self, status, body, ctype="text/plain; charset=utf-8"):
        data = body.encode("utf-8") if isinstance(body, str) else body
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def host_ok(self):
        return self.headers.get("Host", "") in HOSTS  # blocks DNS-rebinding tricks

    def do_GET(self):
        if not self.host_ok():
            return self.send_text(HTTPStatus.FORBIDDEN, "bad host")
        url = urlparse(self.path)
        if url.path == "/presence":
            return self.presence()
        if url.path == "/presets":
            return self.presets_get()
        if url.path == "/version":  # read each time: it is the code that is running now, not what data.js was built with
            try:
                version = build_data.VERSION.read_text(encoding="utf-8").strip()
            except OSError:
                version = ""
            return self.send_text(HTTPStatus.OK, json.dumps({"version": version}), "application/json")
        if url.path == "/ping":
            return self.send_text(HTTPStatus.OK, SIGNATURE)
        if url.path == "/audio":
            return self.audio(parse_qs(url.query).get("p", [""])[0])
        found = static_file(url.path)
        if found:
            try:
                body = open(found[0], "rb").read()
            except OSError:
                return self.send_text(HTTPStatus.NOT_FOUND, "missing " + url.path)
            return self.send_text(HTTPStatus.OK, body, found[1])
        self.send_text(HTTPStatus.NOT_FOUND, "not found")

    def do_POST(self):
        if not self.host_ok():
            return self.send_text(HTTPStatus.FORBIDDEN, "bad host")
        origin = self.headers.get("Origin")
        if origin and origin.split("://", 1)[-1] not in HOSTS:
            return self.send_text(HTTPStatus.FORBIDDEN, "bad origin")
        url = urlparse(self.path)
        if url.path == "/rate":
            return self.rate()
        if url.path == "/presets":
            return self.presets_save()
        if url.path == "/playlist":
            return self.playlist_save()
        if url.path != "/rebuild":
            return self.send_text(HTTPStatus.NOT_FOUND, "not found")
        if not rebuild_lock.acquire(blocking=False):
            return self.send_text(HTTPStatus.CONFLICT, json.dumps({"ok": False, "error": "a rebuild is already running"}),
                                  "application/json")
        buf = io.StringIO()
        try:
            with contextlib.redirect_stdout(buf):
                build_data.main()
            load_allowed()
            out = {"ok": True, "output": buf.getvalue().strip()}
        except Exception as e:  # report to the page instead of dropping the connection
            out = {"ok": False, "error": f"{type(e).__name__}: {e}"}
        finally:
            rebuild_lock.release()
        self.send_text(HTTPStatus.OK, json.dumps(out), "application/json")

    def presets_get(self):
        try:
            with open(PRESETS, encoding="utf-8") as f:
                body = f.read()
        except OSError:
            body = '{"presets": []}'
        self.send_text(HTTPStatus.OK, body, "application/json")

    def presets_save(self):
        """Saved views (presets.json next to this script). The page sends the whole list; it is validated and written atomically."""
        try:
            n = int(self.headers.get("Content-Length", 0))
            if n > 1_000_000:
                raise ValueError("too large")
            data = json.loads(self.rfile.read(n) or b"{}")
            items = data["presets"]
            if not isinstance(items, list) or not all(isinstance(p, dict) and isinstance(p.get("name"), str) and 0 < len(p["name"]) <= 80
                                                      and isinstance(p.get("state"), dict) for p in items):
                raise ValueError("bad presets")
        except (ValueError, KeyError, TypeError) as e:
            return self.send_text(HTTPStatus.BAD_REQUEST, json.dumps({"ok": False, "error": str(e)}), "application/json")
        tmp = PRESETS + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump({"presets": items}, f, ensure_ascii=False, indent=1)
        os.replace(tmp, PRESETS)
        self.send_text(HTTPStatus.OK, json.dumps({"ok": True, "count": len(items)}), "application/json")

    def playlist_save(self):
        """Write the songs the page is showing as "[Gen] <name>.m3u8" in the repo's playlists folder (UTF-8, CRLF, as in
        agents/WRITING-PLAYLISTS.md). Only songs listed in data.js are accepted. Nothing is touched in iTunes: the user imports the file.
        Refuses a name that was already imported (playlists/bak); an unimported file of the same name needs overwrite=true."""
        def fail(status, error, **extra):
            return self.send_text(status, json.dumps({"ok": False, "error": error, **extra}), "application/json")
        try:
            n = int(self.headers.get("Content-Length", 0))
            if n > 8_000_000:
                raise ValueError("too large")
            req = json.loads(self.rfile.read(n) or b"{}")
            songs, overwrite = req["songs"], bool(req.get("overwrite"))
            name = re.sub(r'[\\/*?"<>|\x00-\x1f]', "", str(req["name"]).replace(":", " -"))
            name = re.sub(r"\s+", " ", name).strip(" .")
            if name.lower().startswith(GEN.lower()):
                name = name[len(GEN):].strip()
            if not name or len(name) > 80:
                raise ValueError("give the playlist a name (up to 80 characters)")
            if not isinstance(songs, list) or not songs or len(songs) > 20000:
                raise ValueError("no songs to save")
            lines = ["#EXTM3U"]
            for s in songs:
                path = s["path"]
                if os.path.normcase(path) not in allowed:
                    raise ValueError("a song is not in the library data; click Refresh data and try again")
                label = " - ".join(x for x in (str(s.get("artist", "")), str(s["name"])) if x).replace("\r", " ").replace("\n", " ")
                lines += [f"#EXTINF:{int(s.get('secs', 0))},{label}", path]
        except (ValueError, KeyError, TypeError) as e:
            return fail(HTTPStatus.BAD_REQUEST, str(e))
        fname = f"{GEN}{name}.m3u8"
        out = os.path.join(PLAYLISTS, fname)
        if os.path.exists(os.path.join(PLAYLISTS, "bak", fname)):
            return fail(HTTPStatus.CONFLICT, f'"{GEN}{name}" was already imported (it is in playlists/bak); choose another name', exists="imported")
        if os.path.exists(out) and not overwrite:
            return fail(HTTPStatus.CONFLICT, f'"{fname}" is already in the playlists folder, waiting to be imported', exists="pending")
        os.makedirs(PLAYLISTS, exist_ok=True)
        tmp = out + ".tmp"
        with open(tmp, "wb") as f:
            f.write(("\r\n".join(lines) + "\r\n").encode("utf-8"))
        os.replace(tmp, out)
        self.send_text(HTTPStatus.OK, json.dumps({"ok": True, "file": fname, "count": len(songs), "dir": PLAYLISTS}), "application/json")

    def rate(self):
        """Set one song's star rating in the running iTunes (COM, tools/itunes-com/rate_file.ps1). Only listed songs."""
        try:
            req = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))) or b"{}")
            path, name, stars = req["path"], str(req["name"]), int(req["stars"])
            from_pl = req.get("from_playlist", "")
            if from_pl and TAG not in from_pl:  # taking a song out of a playlist is only for [To Rate] playlists
                raise ValueError("playlist not allowed")
            if os.path.normcase(path) not in allowed or not 0 <= stars <= 5:
                raise ValueError("song not in the library data or stars out of range")
        except (ValueError, KeyError, TypeError) as e:
            return self.send_text(HTTPStatus.BAD_REQUEST, json.dumps({"ok": False, "error": str(e)}), "application/json")
        script = os.path.join(HERE, "..", "itunes-com", "rate_file.ps1")
        try:
            p = subprocess.run(["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", script,
                                "-Path", path, "-Name", name, "-Stars", str(stars)] + (["-FromPlaylist", from_pl] if from_pl else []),
                               capture_output=True, text=True, timeout=60)
            line = (p.stdout.strip().splitlines() or ["ERR no answer"])[-1]
        except (OSError, subprocess.TimeoutExpired) as e:
            line = f"ERR {type(e).__name__}"
        ok = line.startswith("OK ")
        out = {"ok": ok, "stars": int(line[3:4]) if ok else None, "removed": ok and line.endswith("REMOVED"), "error": line[4:]}
        self.send_text(HTTPStatus.OK, json.dumps(out), "application/json")

    def presence(self):
        """Hold the connection open (server-sent events) for as long as the page is alive."""
        global open_streams, ever_seen
        with presence_lock:
            open_streams += 1
            ever_seen = True
        try:
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(b": connected" + bytes([10, 10]))
            self.wfile.flush()
            while True:
                ready, _, _ = select.select([self.connection], [], [], 5)
                if ready:  # readable: the browser closed the stream (EOF) or sent something we ignore
                    if not self.connection.recv(1, socket.MSG_PEEK):
                        break
                    self.connection.recv(4096)
                else:  # quiet for 5 s: send a comment line, which also surfaces a half-dead connection
                    self.wfile.write(b": ping" + bytes([10, 10]))
                    self.wfile.flush()
        except OSError:
            pass  # reset / aborted: same as closed
        finally:
            with presence_lock:
                open_streams -= 1

    def audio(self, path):
        full = os.path.normcase(path)
        if full not in allowed or not os.path.isfile(path):
            return self.send_text(HTTPStatus.NOT_FOUND, "not available")
        size = os.path.getsize(path)
        start, end, status = 0, size - 1, HTTPStatus.OK
        rng = self.headers.get("Range", "")
        if rng.startswith("bytes="):
            a, _, b = rng[6:].split(",")[0].partition("-")
            try:
                if a == "":
                    start = max(0, size - int(b))
                else:
                    start = int(a)
                    end = min(int(b), size - 1) if b else size - 1
            except ValueError:
                start, end = 0, size - 1
            if start > end or start >= size:
                self.send_response(HTTPStatus.REQUESTED_RANGE_NOT_SATISFIABLE)
                self.send_header("Content-Range", f"bytes */{size}")
                self.send_header("Content-Length", "0")
                return self.end_headers()
            status = HTTPStatus.PARTIAL_CONTENT
        self.send_response(status)
        self.send_header("Content-Type", mimetypes.guess_type(path)[0] or "application/octet-stream")
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Length", str(end - start + 1))
        if status == HTTPStatus.PARTIAL_CONTENT:
            self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.end_headers()
        try:
            with open(path, "rb") as f:
                f.seek(start)
                left = end - start + 1
                while left > 0:
                    chunk = f.read(min(65536, left))
                    if not chunk:
                        break
                    self.wfile.write(chunk)
                    left -= len(chunk)
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            pass  # the browser seeked or skipped to the next song


class Server(ThreadingHTTPServer):
    allow_reuse_address = False  # on Windows SO_REUSEADDR would let a second server share a busy port


def is_ours(port):
    """True when a Music Hub helper is already answering on this port."""
    try:
        c = http.client.HTTPConnection("127.0.0.1", port, timeout=1.5)
        c.request("GET", "/ping")
        return c.getresponse().read().decode("utf-8", "ignore") == SIGNATURE
    except OSError:
        return False


def browser_exe():
    """Chrome or Edge (--browser chrome|edge, or LIBRARY_SEARCH_BROWSER; Chrome first by default)."""
    want = (sys.argv[sys.argv.index("--browser") + 1] if "--browser" in sys.argv
            else os.environ.get("LIBRARY_SEARCH_BROWSER", "chrome")).lower()
    roots = [os.environ.get(v) for v in ("ProgramFiles", "ProgramFiles(x86)", "LOCALAPPDATA") if os.environ.get(v)]
    paths = {"chrome": [r"Google\Chrome\Application\chrome.exe"], "edge": [r"Microsoft\Edge\Application\msedge.exe"]}
    for name in (want, "edge" if want == "chrome" else "chrome"):
        for root in roots:
            for rel in paths.get(name, []):
                if os.path.isfile(os.path.join(root, rel)):
                    return os.path.join(root, rel)
    return None


def open_window(url):
    """App-style window (no tabs or address bar) in Chrome/Edge; --tab or no browser found: a normal tab."""
    exe = None if "--tab" in sys.argv else browser_exe()
    if exe:
        try:
            subprocess.Popen([exe, "--app=" + url])
            return
        except OSError:
            pass
    webbrowser.open(url)


def main():
    global PORT, HOSTS, KEEP_ALIVE, SRV
    KEEP_ALIVE = "--keep-alive" in sys.argv
    if "--port" in sys.argv:
        PORT = int(sys.argv[sys.argv.index("--port") + 1])
    elif os.environ.get("LIBRARY_SEARCH_PORT"):
        PORT = int(os.environ["LIBRARY_SEARCH_PORT"])
    quiet = "--no-browser" in sys.argv
    srv = None
    for port in range(PORT, PORT + 50):
        try:
            srv = Server(("127.0.0.1", port), Handler)
            break
        except OSError:
            if is_ours(port):  # already running: just show the window again
                url = f"http://127.0.0.1:{port}/"
                print(f"{name_and_version()} is already running at {url}")
                if not quiet:
                    open_window(url)
                return
            print(f"Port {port} is in use by something else, trying the next one...")
    if srv is None:
        sys.exit(f"No free port between {PORT} and {PORT + 49}.")
    SRV = srv
    migrate_presets()
    PORT = srv.server_address[1]
    HOSTS = {f"127.0.0.1:{PORT}", f"localhost:{PORT}"}
    load_allowed()
    threading.Thread(target=watchdog, daemon=True).start()
    url = f"http://127.0.0.1:{PORT}/"
    print(f"{name_and_version()} running at {url}")
    print("Closing the app window stops it" + (" (disabled: --keep-alive)." if KEEP_ALIVE else ".") + " Ctrl+C also stops it.")
    if not quiet:
        threading.Timer(0.5, lambda: open_window(url)).start()
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


def run(app_dir, files=None, port=9123, signature="music-library-search"):
    """Start the helper for one page (see the top of this file). Returns when the helper stops."""
    global APP_DIR, FILES, PORT, SIGNATURE, HOSTS
    APP_DIR, FILES, PORT, SIGNATURE = app_dir, (None if files is None else set(files)), port, signature
    HOSTS = {f"127.0.0.1:{PORT}", f"localhost:{PORT}"}
    main()
