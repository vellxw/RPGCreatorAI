@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0verify-branding-assets.ps1" %*
exit /b %ERRORLEVEL%
