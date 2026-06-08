# scripts/dev/smoke-packaged-executable-launch.ps1
# Narrow smoke for the packaged Windows executable path. It validates the
# double-click assumptions without relying on the repository terminal cwd.

[CmdletBinding()]
param(
    [string]$PackagedExe = "",
    [int]$HoldSeconds = 5,
    [string]$LaunchWorkingDirectory = "",
    [switch]$AllowRepoWorkingDirectory
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path

function Resolve-LocalAppDataPath {
    param([string]$Leaf)
    $localBase = $env:LOCALAPPDATA
    if (-not $localBase) { $localBase = [Environment]::GetFolderPath('LocalApplicationData') }
    if ($localBase) { return Join-Path $localBase $Leaf }
    return Join-Path $repoRoot $Leaf
}

if (-not $PackagedExe) {
    $PackagedExe = Resolve-LocalAppDataPath 'RPGCreatorAI\tauri-target\debug\rpgcreator-shell.exe'
}

if (-not (Test-Path -LiteralPath $PackagedExe)) {
    throw "Packaged executable not found: $PackagedExe. Run npm run desktop:package:windows first."
}

$resolvedExe = (Resolve-Path -LiteralPath $PackagedExe).Path
$packageDir = Split-Path -Parent $resolvedExe
$runtimeExe = Join-Path $packageDir 'rpg_creator_runtime.exe'
if (-not (Test-Path -LiteralPath $runtimeExe)) {
    throw "Packaged runtime executable not found beside shell: $runtimeExe"
}

if (-not $LaunchWorkingDirectory) {
    $LaunchWorkingDirectory = $packageDir
}
if (-not (Test-Path -LiteralPath $LaunchWorkingDirectory)) {
    throw "Launch working directory not found: $LaunchWorkingDirectory"
}
$resolvedLaunchDir = (Resolve-Path -LiteralPath $LaunchWorkingDirectory).Path

$repoFull = [System.IO.Path]::GetFullPath($repoRoot).TrimEnd('\')
$launchFull = [System.IO.Path]::GetFullPath($resolvedLaunchDir).TrimEnd('\')
if (-not $AllowRepoWorkingDirectory -and $launchFull.StartsWith($repoFull, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Launch working directory is inside the repository, which would not prove a desktop double-click path: $resolvedLaunchDir"
}

Write-Host '=== PACKAGED EXECUTABLE LAUNCH SMOKE ==='
Write-Host "Packaged exe:       $resolvedExe"
Write-Host "Package dir:        $packageDir"
Write-Host "Runtime copy:       $runtimeExe"
Write-Host "Launch working dir: $resolvedLaunchDir"
Write-Host "Repo root:          $repoRoot"

$process = Start-Process -FilePath $resolvedExe `
    -WorkingDirectory $resolvedLaunchDir `
    -PassThru `
    -WindowStyle Hidden

try {
    Start-Sleep -Seconds $HoldSeconds
    if ($process.HasExited) {
        throw "Packaged executable exited during launch smoke with code $($process.ExitCode)"
    }
    Write-Host "PACKAGED EXECUTABLE LAUNCH SMOKE PASSED pid=$($process.Id)"
}
finally {
    if ($process -and -not $process.HasExited) {
        Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
        $process.WaitForExit()
    }
}
