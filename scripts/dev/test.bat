@echo off
REM scripts/dev/test.bat - fallback wrapper for focused frontend/native tests
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0test.ps1" %*
exit /b %ERRORLEVEL%
