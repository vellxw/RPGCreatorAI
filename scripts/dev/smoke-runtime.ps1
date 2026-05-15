# scripts/dev/smoke-runtime.ps1
# Launches the runtime briefly and verifies it stays alive without an
# immediate crash. Captures stdout/stderr to build/runtime_smoke_*.txt.

[CmdletBinding()]
param(
    [int]$DurationSeconds = 3
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
Set-Location $repoRoot

$exe = Join-Path $repoRoot 'build\rpg_creator_runtime.exe'
if (-not (Test-Path $exe)) {
    throw "Runtime executable not built: $exe"
}

$out = Join-Path $repoRoot 'build\runtime_smoke_stdout.txt'
$err = Join-Path $repoRoot 'build\runtime_smoke_stderr.txt'
if (Test-Path $out) { Remove-Item $out }
if (Test-Path $err) { Remove-Item $err }

$proc = Start-Process -FilePath $exe -PassThru `
    -RedirectStandardOutput $out -RedirectStandardError $err `
    -WindowStyle Normal

Start-Sleep -Seconds $DurationSeconds

if ($proc.HasExited) {
    Write-Host "FAIL: process exited early with code $($proc.ExitCode)"
    Write-Host '--- stdout ---'; Get-Content $out -ErrorAction SilentlyContinue
    Write-Host '--- stderr ---'; Get-Content $err -ErrorAction SilentlyContinue
    exit 1
}

Write-Host "OK: process still running (pid=$($proc.Id)) after $DurationSeconds s — terminating..."
$proc.Kill()
$proc.WaitForExit()

Write-Host '--- stdout ---'; Get-Content $out -ErrorAction SilentlyContinue
$stderrContent = Get-Content $err -ErrorAction SilentlyContinue
if ($stderrContent) {
    Write-Host '--- stderr ---'; $stderrContent
    # Treat any [ERROR] line on stderr as a smoke failure
    if ($stderrContent -match '\[ERROR\]') {
        Write-Host 'FAIL: stderr contains [ERROR] lines'
        exit 1
    }
}

Write-Host 'SMOKE PASSED'
exit 0
