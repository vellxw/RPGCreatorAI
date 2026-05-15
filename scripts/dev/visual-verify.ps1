# scripts/dev/visual-verify.ps1
# Runs the deterministic in-process smoke harness (`rpg_creator_runtime
# --smoke-shots <dir>`) which writes BMP screenshots, then converts each
# BMP to PNG and removes the BMP. The runtime drives Game state directly,
# so visual verification does not depend on synthetic keyboard input.

[CmdletBinding()]
param(
    [string]$OutputDir = 'docs\screenshots\phase-2'
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
Set-Location $repoRoot

$exe = Join-Path $repoRoot 'build\rpg_creator_runtime.exe'
if (-not (Test-Path $exe)) { throw "Runtime not built: $exe" }

$absOut = Join-Path $repoRoot $OutputDir
if (Test-Path $absOut) {
    Get-ChildItem $absOut -Filter '*.bmp' -ErrorAction SilentlyContinue | Remove-Item -Force
    Get-ChildItem $absOut -Filter '*.png' -ErrorAction SilentlyContinue | Remove-Item -Force
} else {
    New-Item -ItemType Directory -Path $absOut -Force | Out-Null
}

# Wipe save slot so the chest scenario is reproducible.
$savePath = Join-Path $repoRoot 'saves\slot_1.json'
if (Test-Path $savePath) { Remove-Item $savePath }

Write-Host "=== Running smoke harness ==="
& $exe --smoke-shots $absOut
if ($LASTEXITCODE -ne 0) { throw "smoke harness failed (exit $LASTEXITCODE)" }

Add-Type -AssemblyName System.Drawing
Get-ChildItem $absOut -Filter '*.bmp' | ForEach-Object {
    $bmp = [System.Drawing.Bitmap]::FromFile($_.FullName)
    $pngPath = [System.IO.Path]::ChangeExtension($_.FullName, '.png')
    $bmp.Save($pngPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Remove-Item $_.FullName
}

Write-Host "=== Done. Files in $absOut ==="
Get-ChildItem $absOut | ForEach-Object { Write-Host "  $($_.Name)  $($_.Length) bytes" }
