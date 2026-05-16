@echo off
REM build_bootstrap.bat
REM
REM Phase 1 bootstrap, hardened in Phase 4.1 to build OUTSIDE the OneDrive-
REM synced repo by default. OneDrive's filter holds intermittent locks on
REM the build/_deps/ tree during cmake's FetchContent rename step, which
REM produces "file RENAME failed ... Acceso denegado" errors.
REM
REM Override the build location with:
REM     set BUILD_DIR=C:\some\other\path
REM     build_bootstrap.bat
REM
REM Or pass it inline:
REM     set BUILD_DIR=%CD%\build & build_bootstrap.bat   (in-repo, OneDrive risk)

setlocal

if "%BUILD_DIR%"=="" (
    set BUILD_DIR=%LOCALAPPDATA%\RPGCreatorAI\build
)

echo Using BUILD_DIR=%BUILD_DIR%

call "C:\Program Files\Microsoft Visual Studio\18\Insiders\Common7\Tools\VsDevCmd.bat" -arch=x64 -host_arch=x64 -no_logo
if errorlevel 1 (
    echo ERROR: VsDevCmd.bat not found. Update path or use scripts\dev\verify-runtime.bat.
    exit /b 1
)

set PATH=C:\Program Files\CMake\bin;C:\Users\franc\AppData\Local\Microsoft\WinGet\Packages\Ninja-build.Ninja_Microsoft.Winget.Source_8wekyb3d8bbwe;%PATH%

echo === CLEAN ===
if exist "%BUILD_DIR%" rmdir /s /q "%BUILD_DIR%"

echo === CONFIGURE ===
cmake -S "%~dp0." -B "%BUILD_DIR%" -G Ninja "-DCMAKE_POLICY_VERSION_MINIMUM=3.5"
if %ERRORLEVEL% neq 0 (
    echo CONFIGURE FAILED
    exit /b 1
)

echo === BUILD ===
cmake --build "%BUILD_DIR%"
if %ERRORLEVEL% neq 0 (
    echo BUILD FAILED
    exit /b 1
)

echo === TEST ===
ctest --test-dir "%BUILD_DIR%" --output-on-failure
if %ERRORLEVEL% neq 0 (
    echo TESTS FAILED
    exit /b 1
)

echo === ALL PASSED ===
echo Build dir: %BUILD_DIR%
exit /b 0
