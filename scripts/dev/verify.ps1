# scripts/dev/verify.ps1
# Full validation: clean configure, build, ctest, runtime smoke.
# Self-bootstraps the MSVC dev environment and tool paths so it works
# from any PowerShell.

[CmdletBinding()]
param(
    [switch]$Clean,
    [switch]$SkipSmoke
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
Set-Location $repoRoot

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
    # Fallback: search root VS folder
    $vsRoot = "${env:ProgramFiles}\Microsoft Visual Studio"
    if (Test-Path $vsRoot) {
        $found = Get-ChildItem -Path $vsRoot -Filter VsDevCmd.bat -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
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
    $found = Get-ChildItem -Path "${env:LOCALAPPDATA}\Microsoft\WinGet\Packages" -Filter ninja.exe -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($found) { return $found.FullName }
    $candidates = @(
        "${env:ProgramFiles}\Ninja\ninja.exe",
        "${env:LOCALAPPDATA}\Programs\Ninja\ninja.exe"
    )
    return Find-Tool $candidates 'ninja'
}

$cmake = Find-CMake
$ninja = Find-Ninja
$vsdev = Find-VsDevCmd

Write-Host "=== Tools ==="
Write-Host "  cmake: $cmake"
Write-Host "  ninja: $ninja"
Write-Host "  vsdev: $vsdev"

if ($Clean -and (Test-Path build)) {
    Write-Host "=== CLEAN ==="
    Remove-Item -Recurse -Force build
}

# Compose batch invocation that loads VS env then runs cmake/ctest.
$cmakeDir = Split-Path -Parent $cmake
$ninjaDir = Split-Path -Parent $ninja

$tmp = New-TemporaryFile
$tmpBat = [System.IO.Path]::ChangeExtension($tmp.FullName, '.bat')
Move-Item $tmp.FullName $tmpBat

@"
@echo off
call "$vsdev" -arch=x64 -host_arch=x64 -no_logo
if errorlevel 1 exit /b 1
set PATH=$cmakeDir;$ninjaDir;%PATH%

echo === CONFIGURE ===
cmake --preset default
if errorlevel 1 exit /b 1

echo === BUILD ===
cmake --build --preset default
if errorlevel 1 exit /b 1

echo === TEST ===
ctest --preset default
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
    & (Join-Path $PSScriptRoot 'smoke-runtime.ps1')
    if ($LASTEXITCODE -ne 0) { throw "smoke check failed" }
}

Write-Host "=== ALL PASSED ==="
