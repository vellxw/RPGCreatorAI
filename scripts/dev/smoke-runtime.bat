@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0smoke-runtime.ps1" %*
