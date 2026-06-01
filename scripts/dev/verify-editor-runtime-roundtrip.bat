@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0verify-editor-runtime-roundtrip.ps1" %*
exit /b %ERRORLEVEL%
