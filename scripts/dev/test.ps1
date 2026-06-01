# scripts/dev/test.ps1
# Runs frontend Vitest and C++ CTest against an already-built native tree.

[CmdletBinding()]
param(
    [switch]$SkipFrontend,
    [switch]$SkipRuntime,
    [string]$BuildDir
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
Set-Location $repoRoot

function Resolve-BuildDir {
    param([string]$Override)
    if ($Override) { return $Override }
    $localBase = $env:LOCALAPPDATA
    if (-not $localBase) { $localBase = [Environment]::GetFolderPath('LocalApplicationData') }
    if ($localBase) { return Join-Path $localBase 'RPGCreatorAI\build' }
    return Join-Path $repoRoot 'build'
}

function Invoke-CheckedCommand {
    param(
        [string]$Label,
        [scriptblock]$Command
    )
    & $Command
    if ($LASTEXITCODE -ne 0) {
        throw "$Label failed (exit $LASTEXITCODE)"
    }
}

if (-not $SkipFrontend) {
    Write-Host '=== FRONTEND TESTS ==='
    Invoke-CheckedCommand 'npm test' { & npm test }
}

if (-not $SkipRuntime) {
    $resolvedBuildDir = Resolve-BuildDir -Override $BuildDir
    Write-Host '=== C++ TESTS ==='
    Invoke-CheckedCommand 'ctest' {
        & ctest --test-dir $resolvedBuildDir --output-on-failure
    }
}

Write-Host '=== TESTS PASSED ==='
