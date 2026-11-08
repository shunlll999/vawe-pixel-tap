@echo off
cd /d "%~dp0"
echo Open http://localhost:5173 in your browser
py -m http.server 5173
pause
