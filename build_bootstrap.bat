@echo off
REM Phase 1 Bootstrap Build Script
REM Loads VS developer environment, then runs cmake configure + build + test

call "C:\Program Files\Microsoft Visual Studio\18\Insiders\Common7\Tools\VsDevCmd.bat" -arch=x64 -host_arch=x64 -no_logo

set PATH=C:\Program Files\CMake\bin;C:\Users\franc\AppData\Local\Microsoft\WinGet\Packages\Ninja-build.Ninja_Microsoft.Winget.Source_8wekyb3d8bbwe;%PATH%

echo === CLEAN ===
if exist build rmdir /s /q build

echo === CONFIGURE ===
cmake -S . -B build -G Ninja "-DCMAKE_POLICY_VERSION_MINIMUM=3.5"
if %ERRORLEVEL% neq 0 (
    echo CONFIGURE FAILED
    exit /b 1
)

echo === BUILD ===
cmake --build build
if %ERRORLEVEL% neq 0 (
    echo BUILD FAILED
    exit /b 1
)

echo === TEST ===
ctest --test-dir build --output-on-failure
if %ERRORLEVEL% neq 0 (
    echo TESTS FAILED
    exit /b 1
)

echo === ALL PASSED ===
exit /b 0
