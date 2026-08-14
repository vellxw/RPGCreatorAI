@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0export-windows-portable.ps1" %*
exit /b %ERRORLEVEL%
