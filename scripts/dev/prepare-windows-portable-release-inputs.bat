@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0prepare-windows-portable-release-inputs.ps1" %*
exit /b %ERRORLEVEL%
