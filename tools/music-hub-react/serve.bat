@echo off
rem Starts the helper of the React page and opens it in an app-style window (Chrome, else Edge). It builds the page first when dist\ is missing or older than the source.
rem Closing the app window stops the helper (--keep-alive to disable). If it is already running, this just opens the window again.
rem Default port 9223 (the current page uses 9123, so both can run); a busy port makes it pick the next free one.
rem Options (passed through): --port 9000   --browser edge   --tab (normal tab instead of app window)   --keep-alive   --no-browser   --no-build   --demo (the published classical ratings, no library needed)
rem "py -3" picks the newest installed Python (plain "python" can resolve to LibreOffice's bundled one).
cd /d "%~dp0"
where py >nul 2>nul && (py -3 server.py %*) || (python server.py %*)
if errorlevel 1 pause
