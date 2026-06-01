@echo off
REM scripts/dev/build.bat - fallback wrapper for native configure/build/CTest
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0build.ps1" %*
exit /b %ERRORLEVEL%
