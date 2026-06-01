param(
    [string]$PackagedExe = "",
    [string]$CaptureIconPath = ""
)

$ErrorActionPreference = "Stop"

function Assert-True {
    param(
        [bool]$Condition,
        [string]$Message
    )

    if (-not $Condition) {
        throw $Message
    }
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$iconDir = Join-Path $repoRoot "src-tauri\icons"
$tauriConfigPath = Join-Path $repoRoot "src-tauri\tauri.conf.json"
$brandingDocPath = Join-Path $repoRoot "docs\RELEASE_BRANDING_ASSETS.md"
$sourcePath = Join-Path $iconDir "icon-source.svg"
$expectedIcons = @(
    "icons/32x32.png",
    "icons/64x64.png",
    "icons/128x128.png",
    "icons/128x128@2x.png",
    "icons/icon.ico",
    "icons/icon.icns",
    "icons/icon.png"
)
$expectedPngDimensions = @{
    "32x32.png" = 32
    "64x64.png" = 64
    "128x128.png" = 128
    "128x128@2x.png" = 256
    "icon.png" = 512
    "StoreLogo.png" = 50
    "Square30x30Logo.png" = 30
    "Square44x44Logo.png" = 44
    "Square71x71Logo.png" = 71
    "Square89x89Logo.png" = 89
    "Square107x107Logo.png" = 107
    "Square142x142Logo.png" = 142
    "Square150x150Logo.png" = 150
    "Square284x284Logo.png" = 284
    "Square310x310Logo.png" = 310
}

Assert-True (Test-Path -LiteralPath $sourcePath) "Missing tracked icon source: $sourcePath"
Assert-True (Test-Path -LiteralPath $brandingDocPath) "Missing release branding document: $brandingDocPath"

$tauriConfig = Get-Content -LiteralPath $tauriConfigPath -Raw | ConvertFrom-Json
Assert-True ($tauriConfig.productName -eq "RPGCreatorAI") "Unexpected productName: $($tauriConfig.productName)"
Assert-True ($tauriConfig.app.windows[0].title -eq "RPGCreatorAI") "Unexpected window title: $($tauriConfig.app.windows[0].title)"
Assert-True ($tauriConfig.bundle.category -eq "DeveloperTool") "Unexpected bundle category: $($tauriConfig.bundle.category)"
Assert-True ($tauriConfig.bundle.shortDescription -like "*RPGCreatorAI*") "Bundle shortDescription must mention RPGCreatorAI"
Assert-True ($tauriConfig.bundle.longDescription -like "*filesystem persistence*") "Bundle longDescription must describe the desktop bridge"

$configuredIcons = @($tauriConfig.bundle.icon)
foreach ($icon in $expectedIcons) {
    Assert-True ($configuredIcons -contains $icon) "tauri.conf.json is missing bundle icon entry: $icon"
    Assert-True (Test-Path -LiteralPath (Join-Path $repoRoot "src-tauri\$icon")) "Missing configured icon file: $icon"
}

Add-Type -AssemblyName System.Drawing

foreach ($entry in $expectedPngDimensions.GetEnumerator()) {
    $path = Join-Path $iconDir $entry.Key
    Assert-True (Test-Path -LiteralPath $path) "Missing PNG icon: $($entry.Key)"
    $image = [System.Drawing.Image]::FromFile($path)
    try {
        Assert-True ($image.Width -eq $entry.Value) "$($entry.Key) width was $($image.Width), expected $($entry.Value)"
        Assert-True ($image.Height -eq $entry.Value) "$($entry.Key) height was $($image.Height), expected $($entry.Value)"
    }
    finally {
        $image.Dispose()
    }
}

$icoPath = Join-Path $iconDir "icon.ico"
$ico = New-Object System.Drawing.Icon($icoPath)
try {
    Assert-True ($ico.Width -ge 32) "icon.ico did not expose a usable icon width"
    Assert-True ($ico.Height -ge 32) "icon.ico did not expose a usable icon height"
}
finally {
    $ico.Dispose()
}

$icnsPath = Join-Path $iconDir "icon.icns"
Assert-True (Test-Path -LiteralPath $icnsPath) "Missing icon.icns"
Assert-True ((Get-Item -LiteralPath $icnsPath).Length -gt 1024) "icon.icns looks too small to be valid"

if (-not $PackagedExe) {
    $PackagedExe = Join-Path $env:LOCALAPPDATA "RPGCreatorAI\tauri-target\debug\rpgcreator-shell.exe"
}

if (Test-Path -LiteralPath $PackagedExe) {
    $associatedIcon = [System.Drawing.Icon]::ExtractAssociatedIcon($PackagedExe)
    try {
        Assert-True ($associatedIcon -ne $null) "Packaged executable did not expose an associated icon"
        Assert-True ($associatedIcon.Width -ge 16) "Packaged executable icon width was too small"
        Assert-True ($associatedIcon.Height -ge 16) "Packaged executable icon height was too small"

        if ($CaptureIconPath) {
            $captureFullPath = if ([System.IO.Path]::IsPathRooted($CaptureIconPath)) {
                $CaptureIconPath
            } else {
                Join-Path $repoRoot $CaptureIconPath
            }
            $captureDir = Split-Path -Parent $captureFullPath
            New-Item -ItemType Directory -Force -Path $captureDir | Out-Null
            $bitmap = $associatedIcon.ToBitmap()
            try {
                $bitmap.Save($captureFullPath, [System.Drawing.Imaging.ImageFormat]::Png)
            }
            finally {
                $bitmap.Dispose()
            }
            Write-Host "Captured packaged executable icon: $captureFullPath"
        }
    }
    finally {
        if ($associatedIcon) {
            $associatedIcon.Dispose()
        }
    }
} else {
    Write-Host "Packaged executable not found; skipped associated icon extraction: $PackagedExe"
}

Write-Host "BRANDING ASSETS PASSED"
