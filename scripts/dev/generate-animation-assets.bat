@echo off
setlocal
python "%~dp0generate_animation_assets.py"
exit /b %ERRORLEVEL%
