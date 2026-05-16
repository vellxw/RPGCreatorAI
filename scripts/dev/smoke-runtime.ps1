# scripts/dev/smoke-runtime.ps1
# Launches the runtime briefly and verifies it stays alive without an
# immediate crash. Captures stdout/stderr to <BuildDir>/runtime_smoke_*.txt.

[CmdletBinding()]
param(
    [int]$DurationSeconds = 3,
    [string]$BuildDir
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
Set-Location $repoRoot

# If no BuildDir was provided, prefer the same out-of-OneDrive location
# that verify.ps1 uses, falling back to the in-repo build/.
if (-not $BuildDir) {
    $localBase = $env:LOCALAPPDATA
    if (-not $localBase) { $localBase = [Environment]::GetFolderPath('LocalApplicationData') }
    $candidate = if ($localBase) { Join-Path $localBase 'RPGCreatorAI\build' } else { '' }
    if ($candidate -and (Test-Path (Join-Path $candidate 'rpg_creator_runtime.exe'))) {
        $BuildDir = $candidate
    } else {
        $BuildDir = Join-Path $repoRoot 'build'
    }
}

$exe = Join-Path $BuildDir 'rpg_creator_runtime.exe'
if (-not (Test-Path $exe)) {
    throw "Runtime executable not built: $exe"
}

# The runtime expects to find data/ relative to its working directory; run
# from the repo root so data/maps/town.json etc. resolve correctly.
$out = Join-Path $BuildDir 'runtime_smoke_stdout.txt'
$err = Join-Path $BuildDir 'runtime_smoke_stderr.txt'
if (Test-Path $out) { Remove-Item $out }
if (Test-Path $err) { Remove-Item $err }

$proc = Start-Process -FilePath $exe -PassThru `
    -WorkingDirectory $repoRoot `
    -RedirectStandardOutput $out -RedirectStandardError $err `
    -WindowStyle Normal

Start-Sleep -Seconds $DurationSeconds

if ($proc.HasExited) {
    Write-Host "FAIL: process exited early with code $($proc.ExitCode)"
    Write-Host '--- stdout ---'; Get-Content $out -ErrorAction SilentlyContinue
    Write-Host '--- stderr ---'; Get-Content $err -ErrorAction SilentlyContinue
    exit 1
}

Write-Host "OK: process still running (pid=$($proc.Id)) after $DurationSeconds s -- terminating..."
$proc.Kill()
$proc.WaitForExit()

Write-Host '--- stdout ---'; Get-Content $out -ErrorAction SilentlyContinue
$stderrContent = Get-Content $err -ErrorAction SilentlyContinue
if ($stderrContent) {
    Write-Host '--- stderr ---'; $stderrContent
    if ($stderrContent -match '\[ERROR\]') {
        Write-Host 'FAIL: stderr contains [ERROR] lines'
        exit 1
    }
}

Write-Host 'SMOKE PASSED'
exit 0
