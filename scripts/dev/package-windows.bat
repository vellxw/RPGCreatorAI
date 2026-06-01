@echo off
REM scripts/dev/package-windows.bat - fallback wrapper for local Windows package prototype
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0package-windows.ps1" %*
exit /b %ERRORLEVEL%
