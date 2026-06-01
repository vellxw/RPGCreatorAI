param(
    [string]$SourcePath = "",
    [string]$OutputDir = ""
)

$ErrorActionPreference = "Stop"

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $scriptRoot "..\..")
$iconDir = if ($OutputDir) { $OutputDir } else { Join-Path $repoRoot "src-tauri\icons" }
$source = if ($SourcePath) { Resolve-Path $SourcePath } else { Resolve-Path (Join-Path $iconDir "icon-source.svg") }
$tempDir = Join-Path ([System.IO.Path]::GetTempPath()) ("rpgcreatorai-tauri-icons-" + [System.Guid]::NewGuid().ToString("N"))
$selectedIcons = @(
    "32x32.png",
    "64x64.png",
    "128x128.png",
    "128x128@2x.png",
    "icon.png",
    "icon.ico",
    "icon.icns",
    "StoreLogo.png",
    "Square30x30Logo.png",
    "Square44x44Logo.png",
    "Square71x71Logo.png",
    "Square89x89Logo.png",
    "Square107x107Logo.png",
    "Square142x142Logo.png",
    "Square150x150Logo.png",
    "Square284x284Logo.png",
    "Square310x310Logo.png"
)

New-Item -ItemType Directory -Force -Path $tempDir | Out-Null
New-Item -ItemType Directory -Force -Path $iconDir | Out-Null

$pushed = $false
try {
    Push-Location $repoRoot
    $pushed = $true
    & npx tauri icon $source --output $tempDir
    if ($LASTEXITCODE -ne 0) {
        throw "tauri icon failed with exit code $LASTEXITCODE"
    }

    foreach ($file in $selectedIcons) {
        $generated = Join-Path $tempDir $file
        if (-not (Test-Path -LiteralPath $generated)) {
            throw "Expected generated icon was missing: $file"
        }
        Copy-Item -LiteralPath $generated -Destination (Join-Path $iconDir $file) -Force
    }
}
finally {
    if ($pushed) {
        Pop-Location
    }
    Remove-Item -LiteralPath $tempDir -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "Generated release branding icons from $source"
foreach ($file in $selectedIcons) {
    Write-Host " - $file"
}
