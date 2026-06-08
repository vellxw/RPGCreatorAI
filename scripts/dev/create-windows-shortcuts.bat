@echo off
REM scripts/dev/create-windows-shortcuts.bat - fallback wrapper for current-user shortcut helper
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0create-windows-shortcuts.ps1" %*
exit /b %ERRORLEVEL%
