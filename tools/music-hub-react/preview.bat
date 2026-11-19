@echo off
rem Starts the React preview of Music Hub: the helper (without opening its own page) and the dev server, then opens http://127.0.0.1:5273/.
rem   preview.bat            the React preview
rem   preview.bat vanilla    the current page instead: the same as ..\music-hub\serve.bat (other options, like --tab or --port 9000, go on to it)
rem The helper stops itself when the page is closed. If the helper or the dev server is already running, it is used as it is.
cd /d "%~dp0"
if /i "%~1"=="vanilla" (
  shift
  call "..\music-hub\serve.bat" %1 %2 %3 %4 %5 %6 %7 %8 %9
  exit /b
)
start "Music Hub helper" /min cmd /c ""..\music-hub\serve.bat" --no-browser"
netstat -ano | findstr /r /c:":5273 .*LISTENING" >nul
if not errorlevel 1 (
  echo The dev server is already running: opening it.
  start "" "http://127.0.0.1:5273/"
  exit /b
)
call npm run dev -- --open
if errorlevel 1 pause
