@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0smoke-runtime.ps1" %*
exit /b %ERRORLEVEL%
