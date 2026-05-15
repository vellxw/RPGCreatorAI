@echo off
REM scripts/dev/verify.bat — fallback when PowerShell execution policy blocks .ps1
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0verify.ps1" %*
