@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0smoke-first-run-app-data.ps1" %*
exit /b %ERRORLEVEL%
