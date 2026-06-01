@echo off
REM scripts/dev/verify.bat — fallback when PowerShell execution policy blocks .ps1
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0verify.ps1" %*
exit /b %ERRORLEVEL%
