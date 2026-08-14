@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0validate-horror-bl-asset-gate.ps1" %*
exit /b %errorlevel%
