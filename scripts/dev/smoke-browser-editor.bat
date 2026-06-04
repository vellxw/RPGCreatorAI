@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0smoke-browser-editor.ps1" %*
exit /b %ERRORLEVEL%
