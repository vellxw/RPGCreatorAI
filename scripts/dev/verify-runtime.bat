@echo off
REM scripts/dev/verify-runtime.bat
REM Phase 4.1: configure + build + ctest the C++ runtime in a build directory
REM that lives OUTSIDE OneDrive, to avoid the "file RENAME failed ... Acceso
REM denegado" lock that hits FetchContent when the repo is synced.
REM
REM Default build dir: %LOCALAPPDATA%\RPGCreatorAI\build
REM Override:          set BUILD_DIR=...  before calling this script.

setlocal EnableDelayedExpansion

set REPO_ROOT=%~dp0..\..
pushd "%REPO_ROOT%"
set REPO_ROOT=%CD%
popd

if "%BUILD_DIR%"=="" (
    set BUILD_DIR=%LOCALAPPDATA%\RPGCreatorAI\build
)

echo === Configuration ===
echo   Repo:  %REPO_ROOT%
echo   Build: %BUILD_DIR%

if not exist "%BUILD_DIR%\.." (
    mkdir "%BUILD_DIR%\.." 2>nul
)

REM Locate VsDevCmd.bat
set VSDEV=
for %%v in (
    "%ProgramFiles%\Microsoft Visual Studio\2022\BuildTools\Common7\Tools\VsDevCmd.bat"
    "%ProgramFiles%\Microsoft Visual Studio\2022\Community\Common7\Tools\VsDevCmd.bat"
    "%ProgramFiles%\Microsoft Visual Studio\2022\Professional\Common7\Tools\VsDevCmd.bat"
    "%ProgramFiles%\Microsoft Visual Studio\2022\Enterprise\Common7\Tools\VsDevCmd.bat"
    "%ProgramFiles%\Microsoft Visual Studio\18\Insiders\Common7\Tools\VsDevCmd.bat"
) do (
    if exist %%v (
        set VSDEV=%%v
        goto :got_vsdev
    )
)

echo ERROR: VsDevCmd.bat not found. Install Visual Studio Build Tools (C++ workload).
exit /b 1

:got_vsdev
echo   VsDev: !VSDEV!

call !VSDEV! -arch=x64 -host_arch=x64 -no_logo
if errorlevel 1 (
    echo ERROR: VsDevCmd failed to load.
    exit /b 1
)

REM Make cmake/ninja available
set PATH=%ProgramFiles%\CMake\bin;%PATH%

REM Find ninja in winget packages, ignore failure (cmake will fall back)
for /f "delims=" %%n in ('dir /b /s "%LOCALAPPDATA%\Microsoft\WinGet\Packages\ninja.exe" 2^>nul') do (
    set NINJA_DIR=%%~dpn
    goto :got_ninja
)
:got_ninja
if defined NINJA_DIR set PATH=!NINJA_DIR!;%PATH%

echo === CONFIGURE ===
cmake -S "%REPO_ROOT%" -B "%BUILD_DIR%" -G Ninja -DCMAKE_POLICY_VERSION_MINIMUM=3.5
if errorlevel 1 (
    echo CONFIGURE FAILED
    exit /b 1
)

echo === BUILD ===
cmake --build "%BUILD_DIR%"
if errorlevel 1 (
    echo BUILD FAILED
    exit /b 1
)

echo === TEST ===
ctest --test-dir "%BUILD_DIR%" --output-on-failure
if errorlevel 1 (
    echo TESTS FAILED
    exit /b 1
)

echo === ALL PASSED ===
echo Build dir: %BUILD_DIR%
exit /b 0
