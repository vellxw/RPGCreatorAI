# scripts/dev/verify.ps1
# Full validation: clean configure, build, ctest, runtime smoke.
# Self-bootstraps the MSVC dev environment and tool paths so it works
# from any PowerShell.
#
# Phase 4.1 hardening:
#   * No `New-TemporaryFile` (unavailable on some Windows PowerShell
#     versions). Uses [System.IO.Path]::GetTempFileName() instead.
#   * Builds OUTSIDE the OneDrive-synced repo by default to dodge
#     "file RENAME failed ... Acceso denegado" during FetchContent.
#     Override with -BuildDir if you need an in-repo build.

[CmdletBinding()]
param(
    [switch]$Clean,
    [switch]$SkipSmoke,
    [string]$BuildDir
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
Set-Location $repoRoot

# ---------------------------------------------------------------------------
# Pick a build directory that is NOT inside OneDrive.
# OneDrive's file-system filter intermittently locks paths during cmake's
# FetchContent rename step, which produces:
#   file RENAME failed to rename ... because: Acceso denegado.
# Building under %LOCALAPPDATA% (which is excluded from OneDrive) avoids it.
# ---------------------------------------------------------------------------
function Resolve-BuildDir {
    param([string]$Override)
    if ($Override) { return $Override }

    $localBase = $env:LOCALAPPDATA
    if (-not $localBase) { $localBase = [Environment]::GetFolderPath('LocalApplicationData') }
    if ($localBase) {
        return Join-Path $localBase 'RPGCreatorAI\build'
    }

    # Fall back to in-repo build/ if LOCALAPPDATA somehow isn't available.
    return (Join-Path $repoRoot 'build')
}

function Find-Tool {
    param([string[]]$Candidates, [string]$Name)
    foreach ($c in $Candidates) { if (Test-Path $c) { return $c } }
    $cmd = Get-Command $Name -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    throw "Required tool not found: $Name"
}

function Find-VsDevCmd {
    $candidates = @(
        "${env:ProgramFiles}\Microsoft Visual Studio\2022\BuildTools\Common7\Tools\VsDevCmd.bat",
        "${env:ProgramFiles}\Microsoft Visual Studio\2022\Community\Common7\Tools\VsDevCmd.bat",
        "${env:ProgramFiles}\Microsoft Visual Studio\2022\Professional\Common7\Tools\VsDevCmd.bat",
        "${env:ProgramFiles}\Microsoft Visual Studio\2022\Enterprise\Common7\Tools\VsDevCmd.bat",
        "${env:ProgramFiles}\Microsoft Visual Studio\18\Insiders\Common7\Tools\VsDevCmd.bat"
    )
    foreach ($c in $candidates) { if (Test-Path $c) { return $c } }
    $vsRoot = "${env:ProgramFiles}\Microsoft Visual Studio"
    if (Test-Path $vsRoot) {
        $found = Get-ChildItem -Path $vsRoot -Filter VsDevCmd.bat -Recurse -ErrorAction SilentlyContinue |
                 Select-Object -First 1
        if ($found) { return $found.FullName }
    }
    throw "VsDevCmd.bat not found. Install Visual Studio Build Tools or Visual Studio with C++ workload."
}

function Find-CMake {
    $candidates = @(
        "${env:ProgramFiles}\CMake\bin\cmake.exe",
        "${env:ProgramFiles(x86)}\CMake\bin\cmake.exe",
        "${env:LOCALAPPDATA}\Programs\CMake\bin\cmake.exe"
    )
    return Find-Tool $candidates 'cmake'
}

function Find-Ninja {
    $found = Get-ChildItem -Path "${env:LOCALAPPDATA}\Microsoft\WinGet\Packages" `
                -Filter ninja.exe -Recurse -ErrorAction SilentlyContinue |
             Select-Object -First 1
    if ($found) { return $found.FullName }
    $candidates = @(
        "${env:ProgramFiles}\Ninja\ninja.exe",
        "${env:LOCALAPPDATA}\Programs\Ninja\ninja.exe"
    )
    return Find-Tool $candidates 'ninja'
}

function New-CompatTempBat {
    # Cross-version-safe replacement for New-TemporaryFile, which is missing
    # on some Windows PowerShell installs. .NET's GetTempFileName() is
    # available in every PS version we care about.
    $tmp = [System.IO.Path]::GetTempFileName()
    $bat = [System.IO.Path]::ChangeExtension($tmp, '.bat')
    Move-Item -Path $tmp -Destination $bat -Force
    return $bat
}

$cmake = Find-CMake
$ninja = Find-Ninja
$vsdev = Find-VsDevCmd

$buildDir = Resolve-BuildDir -Override $BuildDir
$buildParent = Split-Path -Parent $buildDir
if (-not (Test-Path $buildParent)) {
    New-Item -ItemType Directory -Path $buildParent -Force | Out-Null
}

Write-Host "=== Tools ==="
Write-Host "  cmake:  $cmake"
Write-Host "  ninja:  $ninja"
Write-Host "  vsdev:  $vsdev"
Write-Host "  build:  $buildDir"
if ($buildDir -like "$repoRoot*") {
    Write-Host "  NOTE:   build dir is inside the repo (OneDrive may cause locks)"
}

if ($Clean -and (Test-Path $buildDir)) {
    Write-Host "=== CLEAN ==="
    Remove-Item -Recurse -Force $buildDir
}

# Compose batch invocation that loads VS env then runs cmake/ctest.
$cmakeDir = Split-Path -Parent $cmake
$ninjaDir = Split-Path -Parent $ninja

$tmpBat = New-CompatTempBat

# We pass the build dir explicitly to cmake so the output goes outside OneDrive.
@"
@echo off
call "$vsdev" -arch=x64 -host_arch=x64 -no_logo
if errorlevel 1 exit /b 1
set PATH=$cmakeDir;$ninjaDir;%PATH%

echo === CONFIGURE ===
cmake -S "$repoRoot" -B "$buildDir" -G Ninja -DCMAKE_POLICY_VERSION_MINIMUM=3.5
if errorlevel 1 exit /b 1

echo === BUILD ===
cmake --build "$buildDir"
if errorlevel 1 exit /b 1

echo === TEST ===
ctest --test-dir "$buildDir" --output-on-failure
if errorlevel 1 exit /b 1

exit /b 0
"@ | Set-Content -Path $tmpBat -Encoding ASCII

try {
    & cmd /c "$tmpBat"
    if ($LASTEXITCODE -ne 0) { throw "verify pipeline failed (exit $LASTEXITCODE)" }
} finally {
    Remove-Item $tmpBat -ErrorAction SilentlyContinue
}

if (-not $SkipSmoke) {
    Write-Host "=== RUNTIME SMOKE ==="
    & (Join-Path $PSScriptRoot 'smoke-runtime.ps1') -BuildDir $buildDir
    if ($LASTEXITCODE -ne 0) { throw "smoke check failed" }
}

Write-Host "=== ALL PASSED ==="
Write-Host "Build dir: $buildDir"
