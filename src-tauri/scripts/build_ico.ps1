# Generates icon.ico from icon.png via System.Drawing.
# Run from repo root: powershell -File src-tauri/scripts/build_ico.ps1
Add-Type -AssemblyName System.Drawing

$iconDir = Join-Path $PSScriptRoot '..\icons'
$png = Join-Path $iconDir 'icon.png'
$ico = Join-Path $iconDir 'icon.ico'

$bmp = [System.Drawing.Bitmap]::FromFile($png)
$icon = [System.Drawing.Icon]::FromHandle($bmp.GetHicon())

$fs = [System.IO.File]::Open($ico, 'Create')
$icon.Save($fs)
$fs.Close()
$bmp.Dispose()
Write-Host "Wrote $ico"
