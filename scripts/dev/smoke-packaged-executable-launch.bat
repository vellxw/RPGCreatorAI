@echo off
REM scripts/dev/smoke-packaged-executable-launch.bat - fallback wrapper for packaged executable launch smoke
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0smoke-packaged-executable-launch.ps1" %*
exit /b %ERRORLEVEL%
