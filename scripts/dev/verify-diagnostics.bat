@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0verify-diagnostics.ps1" %*
exit /b %ERRORLEVEL%
