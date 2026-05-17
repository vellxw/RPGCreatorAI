[CmdletBinding()]
param(
    [string]$BuildDir
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path

function Resolve-BuildDir {
    param([string]$Override)
    if ($Override) { return $Override }
    $localBase = $env:LOCALAPPDATA
    if (-not $localBase) { $localBase = [Environment]::GetFolderPath('LocalApplicationData') }
    if ($localBase) { return Join-Path $localBase 'RPGCreatorAI\build' }
    return Join-Path $repoRoot 'build'
}

$resolvedBuildDir = Resolve-BuildDir -Override $BuildDir
$runtimeExe = Join-Path $resolvedBuildDir 'rpg_creator_runtime.exe'
if (-not (Test-Path $runtimeExe)) {
    throw "Runtime executable not found: $runtimeExe"
}

$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("RPGCreatorAI-roundtrip-" + [guid]::NewGuid().ToString('N'))
$projectRoot = Join-Path $tempRoot 'project'
$baselineShots = Join-Path $tempRoot 'baseline'
$editedShots = Join-Path $tempRoot 'edited'

try {
    New-Item -ItemType Directory -Path $projectRoot | Out-Null
    Copy-Item -Recurse -Force (Join-Path $repoRoot 'data') (Join-Path $projectRoot 'data')
    New-Item -ItemType Directory -Path (Join-Path $projectRoot 'assets\generated') -Force | Out-Null
    New-Item -ItemType Directory -Path (Join-Path $projectRoot 'saves') -Force | Out-Null
    Copy-Item -Recurse -Force (Join-Path $repoRoot 'assets\generated\runtime') (Join-Path $projectRoot 'assets\generated\runtime')

    Push-Location $projectRoot
    try {
        $baselineLog = & $runtimeExe '--smoke-shots' $baselineShots 2>&1
        if ($LASTEXITCODE -ne 0) {
            throw "Baseline runtime smoke failed:`n$($baselineLog -join [Environment]::NewLine)"
        }
    } finally {
        Pop-Location
    }

    $townPath = Join-Path $projectRoot 'data\maps\town.json'
    $town = Get-Content $townPath -Raw | ConvertFrom-Json
    $visibleTileIndex = 4 * [int]$town.width + 5
    $town.layers[0].tiles[$visibleTileIndex] = 3
    $town | ConvertTo-Json -Depth 32 | Set-Content -Path $townPath -Encoding UTF8

    Push-Location $projectRoot
    try {
        $editedLog = & $runtimeExe '--smoke-shots' $editedShots 2>&1
        if ($LASTEXITCODE -ne 0) {
            throw "Edited runtime smoke failed:`n$($editedLog -join [Environment]::NewLine)"
        }
    } finally {
        Pop-Location
    }

    $baselineShot = Join-Path $baselineShots '01-town-initial.bmp'
    $editedShot = Join-Path $editedShots '01-town-initial.bmp'
    $baselineHash = (Get-FileHash $baselineShot -Algorithm SHA256).Hash
    $editedHash = (Get-FileHash $editedShot -Algorithm SHA256).Hash

    if ($baselineHash -eq $editedHash) {
        throw 'Runtime round-trip failed: edited town screenshot hash matched baseline.'
    }

    if (($editedLog -join "`n") -notmatch '\[INFO\] Map loaded: town') {
        throw 'Runtime round-trip failed: edited runtime log never loaded town.'
    }

    Write-Host 'OK: editor/runtime round-trip proof passed.'
    Write-Host "  baseline screenshot hash: $baselineHash"
    Write-Host "  edited screenshot hash:   $editedHash"
    Write-Host '  runtime loaded edited data from the temporary project copy.'
} finally {
    if (Test-Path $tempRoot) {
        $resolvedTempRoot = (Resolve-Path $tempRoot).Path
        $tempBase = [System.IO.Path]::GetTempPath().TrimEnd('\')
        if (-not $resolvedTempRoot.StartsWith($tempBase, [System.StringComparison]::OrdinalIgnoreCase)) {
            throw "Refusing to delete unexpected path outside temp: $resolvedTempRoot"
        }
        Remove-Item -Recurse -Force -LiteralPath $resolvedTempRoot
    }
}
