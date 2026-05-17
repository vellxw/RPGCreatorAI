@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0verify-editor-runtime-roundtrip.ps1" %*
