@echo off
rem Starts the Music Hub helper and opens it in an app-style window (Chrome, else Edge).
rem Closing the app window stops the helper (--keep-alive to disable). If it is already running, this just opens the window again.
rem Default port 9123; a busy port makes it pick the next free one.
rem Options (passed through): --port 9000   --browser edge   --tab (normal tab instead of app window)   --keep-alive
rem "py -3" picks the newest installed Python (plain "python" can resolve to LibreOffice's bundled one).
cd /d "%~dp0"
where py >nul 2>nul && (py -3 server.py %*) || (python server.py %*)
if errorlevel 1 pause
