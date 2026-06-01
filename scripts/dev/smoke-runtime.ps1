# scripts/dev/smoke-runtime.ps1
# Launches the runtime briefly, then runs the deterministic Phase 10 MVP
# feature smoke path and validates real logs plus screenshot evidence.

[CmdletBinding()]
param(
    [int]$DurationSeconds = 3,
    [string]$BuildDir,
    [string]$ScreenshotDir
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
Set-Location $repoRoot
$usingDefaultScreenshotDir = -not $PSBoundParameters.ContainsKey('ScreenshotDir') -or
    [string]::IsNullOrWhiteSpace($ScreenshotDir)

function Read-LogText {
    param([string]$Path)
    if (-not (Test-Path $Path)) { return '' }
    return (Get-Content $Path -Raw -ErrorAction SilentlyContinue)
}

function Write-LogBlock {
    param(
        [string]$Title,
        [string]$Path
    )
    Write-Host "--- $Title ---"
    $text = Read-LogText $Path
    if ($text) {
        Write-Host $text
    }
}

function Fail-Smoke {
    param(
        [string]$Message,
        [string]$StdoutPath,
        [string]$StderrPath
    )
    Write-Host "FAIL: $Message"
    if ($StdoutPath) { Write-LogBlock 'stdout' $StdoutPath }
    if ($StderrPath) { Write-LogBlock 'stderr' $StderrPath }
    exit 1
}

function Assert-Contains {
    param(
        [string]$Text,
        [string]$Expected,
        [string]$StdoutPath,
        [string]$StderrPath
    )
    if (-not $Text.Contains($Expected)) {
        Fail-Smoke "expected runtime smoke log marker not found: $Expected" $StdoutPath $StderrPath
    }
}

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

if (-not $ScreenshotDir) {
    $ScreenshotDir = Join-Path $repoRoot 'docs\screenshots\phase10-mvp'
} elseif (-not [System.IO.Path]::IsPathRooted($ScreenshotDir)) {
    $ScreenshotDir = Join-Path $repoRoot $ScreenshotDir
}
$ScreenshotDir = (New-Item -ItemType Directory -Force -Path $ScreenshotDir).FullName

$expectedScreenshots = @(
    'phase10-01-route-coach-dialogue.bmp',
    'phase10-02-event-route-after.bmp',
    'phase10-03-foreground-occlusion.bmp'
)
foreach ($name in $expectedScreenshots) {
    $path = Join-Path $ScreenshotDir $name
    if (Test-Path $path) { Remove-Item $path }
}

# The runtime expects to find data/ relative to its working directory; run
# from the repo root so data/maps/town.json etc. resolve correctly.
$out = Join-Path $BuildDir 'runtime_smoke_stdout.txt'
$err = Join-Path $BuildDir 'runtime_smoke_stderr.txt'
if (Test-Path $out) { Remove-Item $out }
if (Test-Path $err) { Remove-Item $err }

Write-Host '== RUNTIME LAUNCH SMOKE =='
$proc = Start-Process -FilePath $exe -PassThru `
    -WorkingDirectory $repoRoot `
    -RedirectStandardOutput $out -RedirectStandardError $err `
    -WindowStyle Hidden

Start-Sleep -Seconds $DurationSeconds

if ($proc.HasExited) {
    Fail-Smoke "process exited early with code $($proc.ExitCode)" $out $err
}

Write-Host "OK: process still running (pid=$($proc.Id)) after $DurationSeconds s -- terminating..."
$proc.Kill()
$proc.WaitForExit()

Write-LogBlock 'stdout' $out
$stderrContent = Read-LogText $err
if ($stderrContent) {
    Write-LogBlock 'stderr' $err
    if ($stderrContent -match '\[ERROR\]') {
        Fail-Smoke 'stderr contains [ERROR] lines' $out $err
    }
}

Write-Host '== RUNTIME FEATURE SMOKE SHOTS =='
$shotsOut = Join-Path $BuildDir 'runtime_smoke_shots_stdout.txt'
$shotsErr = Join-Path $BuildDir 'runtime_smoke_shots_stderr.txt'
if (Test-Path $shotsOut) { Remove-Item $shotsOut }
if (Test-Path $shotsErr) { Remove-Item $shotsErr }

$quotedScreenshotDir = '"{0}"' -f ($ScreenshotDir -replace '"', '\"')
$shotsProc = Start-Process -FilePath $exe -PassThru -Wait `
    -WorkingDirectory $repoRoot `
    -ArgumentList @('--smoke-shots', $quotedScreenshotDir) `
    -RedirectStandardOutput $shotsOut -RedirectStandardError $shotsErr `
    -WindowStyle Hidden

Write-LogBlock 'stdout' $shotsOut
$shotsStderr = Read-LogText $shotsErr
if ($shotsStderr) {
    Write-LogBlock 'stderr' $shotsErr
}

$combinedFeatureLog = (Read-LogText $shotsOut) + "`n" + (Read-LogText $shotsErr)
if ($shotsProc.ExitCode -ne 0) {
    Fail-Smoke "runtime smoke shots exited with code $($shotsProc.ExitCode)" $shotsOut $shotsErr
}
if ($combinedFeatureLog -match '\[ERROR\]') {
    Fail-Smoke 'runtime smoke shots contain [ERROR] lines' $shotsOut $shotsErr
}

foreach ($expected in @(
    '"commandType":"showChoices"',
    '"result":"selected=0"',
    '"commandType":"setMovementRoute"',
    'target=event',
    'Audio requested: chest_open',
    'pluginCommand debug.log',
    'Smoke shots complete'
)) {
    Assert-Contains $combinedFeatureLog $expected $shotsOut $shotsErr
}

foreach ($name in $expectedScreenshots) {
    $path = Join-Path $ScreenshotDir $name
    if (-not (Test-Path $path)) {
        Fail-Smoke "expected smoke screenshot was not written: $path" $shotsOut $shotsErr
    }
}

if ($usingDefaultScreenshotDir) {
    $retain = @{}
    foreach ($name in $expectedScreenshots) { $retain[$name] = $true }
    Get-ChildItem -Path $ScreenshotDir -Filter '*.bmp' -File |
        Where-Object { -not $retain.ContainsKey($_.Name) } |
        Remove-Item
}

Write-Host "Screenshots: $ScreenshotDir"
Write-Host 'SMOKE PASSED'
exit 0
