@echo off
rem ============================================================================
rem  JARVIS - One-click launcher
rem  Double-click this file to open the JARVIS desktop app. The app auto-starts
rem  the JARVIS Core in the background and shuts it down when you close it.
rem
rem  Requires the app to be built first:  npm run build
rem ============================================================================
cd /d "%~dp0"

start "" "%~dp0node_modules\electron\dist\electron.exe" "%~dp0"
