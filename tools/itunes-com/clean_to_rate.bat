@echo off
rem Removes the songs you have rated from "[Gen] To Rate" (playlist entry only; songs stay in iTunes).
rem Shows who would go first, then asks. Double-click it, or pass another playlist name as the first argument.
setlocal
set "PL=%~1"
if "%PL%"=="" set "PL=[Gen] To Rate"
cd /d "%~dp0"
echo iTunes must be running. Checking "%PL%"...
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File remove_rated.ps1 -Playlist "%PL%"
echo.
choice /m "Remove these from the playlist"
if errorlevel 2 (echo Nothing changed. & goto :end)
powershell -NoProfile -ExecutionPolicy Bypass -File remove_rated.ps1 -Playlist "%PL%" -Apply
:end
echo.
pause
