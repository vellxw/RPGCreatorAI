# scripts/dev/package-windows.ps1
# Builds a local Windows packaged prototype and smoke-launches the produced
# Tauri executable. This is an unsigned no-bundle artifact for developer QA.

[CmdletBinding()]
param(
    [switch]$Clean,
    [switch]$SkipNativeBuild,
    [switch]$SkipSmoke,
    [string]$BuildDir,
    [string]$CargoTargetDir
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
Set-Location $repoRoot

function Resolve-LocalAppDataPath {
    param([string]$Leaf)
    $localBase = $env:LOCALAPPDATA
    if (-not $localBase) { $localBase = [Environment]::GetFolderPath('LocalApplicationData') }
    if ($localBase) { return Join-Path $localBase $Leaf }
    return Join-Path $repoRoot $Leaf
}

function Resolve-NativeBuildDir {
    param([string]$Override)
    if ($Override) { return $Override }
    return Resolve-LocalAppDataPath 'RPGCreatorAI\build'
}

function Resolve-CargoTargetDir {
    param([string]$Override)
    if ($Override) { return $Override }
    return Resolve-LocalAppDataPath 'RPGCreatorAI\tauri-target'
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

function Find-PackagedExe {
    param([string]$TargetDir)
    $debugDir = Join-Path $TargetDir 'debug'
    $preferred = @(
        (Join-Path $debugDir 'RPGCreatorAI.exe'),
        (Join-Path $debugDir 'rpgcreator-shell.exe')
    )
    foreach ($candidate in $preferred) {
        if (Test-Path $candidate) { return (Resolve-Path $candidate).Path }
    }

    $found = Get-ChildItem -Path $debugDir -Filter *.exe -File -ErrorAction SilentlyContinue |
        Where-Object { $_.FullName -notmatch '\\deps\\' } |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1
    if ($found) { return $found.FullName }
    throw "Packaged Tauri executable not found under $debugDir"
}

$resolvedBuildDir = Resolve-NativeBuildDir -Override $BuildDir
$resolvedCargoTargetDir = Resolve-CargoTargetDir -Override $CargoTargetDir

Write-Host '=== WINDOWS PACKAGE PROTOTYPE ==='
Write-Host "Repo:          $repoRoot"
Write-Host "Native build:  $resolvedBuildDir"
Write-Host "Cargo target:  $resolvedCargoTargetDir"

if (-not $SkipNativeBuild) {
    $buildScript = Join-Path $PSScriptRoot 'build.ps1'
    Invoke-CheckedCommand 'native configure/build/test' {
        if ($Clean) {
            & $buildScript -Clean -BuildDir $resolvedBuildDir
        } else {
            & $buildScript -BuildDir $resolvedBuildDir
        }
    }
}

$runtimeExe = Join-Path $resolvedBuildDir 'rpg_creator_runtime.exe'
if (-not (Test-Path $runtimeExe)) {
    throw "Runtime executable not found at $runtimeExe"
}

$targetParent = Split-Path -Parent $resolvedCargoTargetDir
if ($targetParent -and -not (Test-Path $targetParent)) {
    New-Item -ItemType Directory -Path $targetParent -Force | Out-Null
}

$previousCargoTargetDir = $env:CARGO_TARGET_DIR
$env:CARGO_TARGET_DIR = $resolvedCargoTargetDir
try {
    Invoke-CheckedCommand 'tauri packaged prototype build' {
        & npm run desktop:build
    }
} finally {
    if ($null -ne $previousCargoTargetDir) {
        $env:CARGO_TARGET_DIR = $previousCargoTargetDir
    } else {
        Remove-Item Env:\CARGO_TARGET_DIR -ErrorAction SilentlyContinue
    }
}

$packagedExe = Find-PackagedExe -TargetDir $resolvedCargoTargetDir
$packageDir = Split-Path -Parent $packagedExe
$packagedRuntime = Join-Path $packageDir 'rpg_creator_runtime.exe'
Copy-Item -LiteralPath $runtimeExe -Destination $packagedRuntime -Force

Write-Host "Packaged exe:  $packagedExe"
Write-Host "Runtime copy:  $packagedRuntime"

if (-not $SkipSmoke) {
    $launchSmoke = Join-Path $PSScriptRoot 'smoke-packaged-executable-launch.ps1'
    & $launchSmoke -PackagedExe $packagedExe -HoldSeconds 5
    if ($LASTEXITCODE -ne 0) {
        throw "packaged executable launch smoke failed (exit $LASTEXITCODE)"
    }
    Write-Host 'PACKAGED SMOKE PASSED'
} else {
    Write-Host 'PACKAGED SMOKE SKIPPED'
}

Write-Host '=== WINDOWS PACKAGE PROTOTYPE PASSED ==='
