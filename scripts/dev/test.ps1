# scripts/dev/test.ps1
# Runs ctest against an already-built tree (does not rebuild).
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
Set-Location $repoRoot

$cmake = "${env:ProgramFiles}\CMake\bin\cmake.exe"
$ctest = "${env:ProgramFiles}\CMake\bin\ctest.exe"
if (-not (Test-Path $ctest)) { throw "ctest not found at $ctest" }

& $ctest --preset default
exit $LASTEXITCODE
