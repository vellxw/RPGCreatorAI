# Fast pixel-level analysis using LockBits to verify visible content
# without manually inspecting PNGs.

[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$shotDir = (Resolve-Path 'docs\screenshots\phase-2').Path

# Renderer2D palette
$palette = [ordered]@{
    Ground   = @(72, 132, 82)
    Wall     = @(52, 52, 68)
    Player   = @(240, 220, 60)
    NPC      = @(220, 90, 90)
    Chest    = @(200, 140, 40)
    Transfer = @(90, 160, 230)
    Bg       = @(12, 14, 20)
    DlgEdge  = @(230, 230, 230)
}

function Analyze-Image {
    param([string]$path)
    $bmp = New-Object System.Drawing.Bitmap $path
    $w = $bmp.Width; $h = $bmp.Height
    $rect = New-Object System.Drawing.Rectangle 0, 0, $w, $h
    $data = $bmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $bytes = New-Object byte[] ($data.Stride * $h)
    [System.Runtime.InteropServices.Marshal]::Copy($data.Scan0, $bytes, 0, $bytes.Length) | Out-Null
    $bmp.UnlockBits($data) | Out-Null
    $bmp.Dispose()

    $stride = $data.Stride
    # In-process backbuffers have no window chrome — sample everything.
    $titleSkip = 0
    $step = 2

    $counts = @{}
    foreach ($k in $palette.Keys) { $counts[$k] = 0 }
    $total = 0
    $threshold = 50  # squared distance threshold
    $thresholdSq = $threshold * $threshold

    for ($y = $titleSkip; $y -lt $h; $y += $step) {
        $row = $y * $stride
        for ($x = 0; $x -lt $w; $x += $step) {
            $i = $row + $x * 4
            $b = [int]$bytes[$i]
            $g = [int]$bytes[$i + 1]
            $r = [int]$bytes[$i + 2]
            foreach ($k in $palette.Keys) {
                $p = $palette[$k]
                $dr = $r - $p[0]; $dg = $g - $p[1]; $db = $b - $p[2]
                $d2 = $dr*$dr + $dg*$dg + $db*$db
                if ($d2 -lt $thresholdSq) {
                    $counts[$k]++
                    break
                }
            }
            $total++
        }
    }

    $present = @{}
    foreach ($k in $palette.Keys) {
        $pct = if ($total -gt 0) { 100.0 * $counts[$k] / $total } else { 0 }
        $present[$k] = $pct
    }
    return $present
}

$results = @{}
Get-ChildItem $shotDir -Filter '*.bmp' | Sort-Object Name | ForEach-Object {
    $r = Analyze-Image -path $_.FullName
    $results[$_.Name] = $r
}

$keys = @('Ground','Wall','Player','NPC','Chest','Transfer','Bg','DlgEdge')
$header = ('{0,-30}' -f 'image') + ($keys | ForEach-Object { ('{0,9}' -f $_) }) -join ''
Write-Host $header
Write-Host ('-' * $header.Length)

foreach ($name in ($results.Keys | Sort-Object)) {
    $row = '{0,-30}' -f $name
    foreach ($k in $keys) {
        $row += '{0,9}' -f ('{0:F2}' -f $results[$name][$k])
    }
    Write-Host $row
}
