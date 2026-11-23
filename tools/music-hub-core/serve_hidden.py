"""Runs a page's server.py with no console window: what each page's serve.pyw calls.

pythonw.exe (what a .pyw file runs with) has no console, so there is nowhere to print. Everything the helper would print goes to
logs\\<page folder>.log in the repo (logs\\music-hub.log, logs\\music-hub-react.log; rewritten at each start), which is also where a crash
or "no free port" shows up. The logs folder is git-ignored.
"""
import os
import runpy
import sys


def run(page_dir):
    os.chdir(page_dir)
    logs = os.path.join(page_dir, "..", "..", "logs")
    os.makedirs(logs, exist_ok=True)
    name = os.path.basename(os.path.normpath(page_dir)) + ".log"
    log = open(os.path.join(logs, name), "w", buffering=1, encoding="utf-8")   # line by line, so it is current when you open it
    sys.stdout = sys.stderr = log
    runpy.run_path(os.path.join(page_dir, "server.py"), run_name="__main__")
