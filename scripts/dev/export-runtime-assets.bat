@echo off
python "%~dp0export_runtime_assets.py" --project-root "%~dp0..\.." %*
exit /b %ERRORLEVEL%
