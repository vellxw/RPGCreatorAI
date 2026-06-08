# scripts/dev/create-windows-shortcuts.ps1
# User-scoped shortcut helper for the unsigned packaged prototype. Dry-run by
# default; pass -Apply to create .lnk files outside the repository.

[CmdletBinding()]
param(
    [string]$PackagedExe = "",
    [switch]$Desktop,
    [switch]$StartMenu,
    [switch]$Apply,
    [switch]$Force
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

function Resolve-AppDataPath {
    param([string]$Leaf)
    $roamingBase = $env:APPDATA
    if (-not $roamingBase) { $roamingBase = [Environment]::GetFolderPath('ApplicationData') }
    if ($roamingBase) { return Join-Path $roamingBase $Leaf }
    throw 'Could not resolve current-user APPDATA for Start Menu shortcut.'
}

function Add-ShortcutTarget {
    param(
        [System.Collections.Generic.List[object]]$Targets,
        [string]$Kind,
        [string]$Path
    )
    $Targets.Add([pscustomobject]@{ Kind = $Kind; Path = $Path }) | Out-Null
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

$useDesktop = $Desktop.IsPresent -or (-not $Desktop.IsPresent -and -not $StartMenu.IsPresent)
$useStartMenu = $StartMenu.IsPresent -or (-not $Desktop.IsPresent -and -not $StartMenu.IsPresent)
$targets = [System.Collections.Generic.List[object]]::new()

if ($useDesktop) {
    $desktopDir = [Environment]::GetFolderPath('DesktopDirectory')
    if (-not $desktopDir) { throw 'Could not resolve current-user Desktop folder.' }
    Add-ShortcutTarget -Targets $targets -Kind 'Desktop' -Path (Join-Path $desktopDir 'RPGCreatorAI.lnk')
}

if ($useStartMenu) {
    $startMenuPrograms = Resolve-AppDataPath 'Microsoft\Windows\Start Menu\Programs'
    Add-ShortcutTarget -Targets $targets -Kind 'StartMenu' -Path (Join-Path $startMenuPrograms 'RPGCreatorAI.lnk')
}

Write-Host '=== WINDOWS SHORTCUT GUIDANCE ==='
Write-Host "Packaged exe: $resolvedExe"
Write-Host "Runtime copy: $runtimeExe"
Write-Host "Package dir:  $packageDir"
Write-Host "Mode:         $(if ($Apply) { 'apply' } else { 'dry-run' })"

foreach ($target in $targets) {
    Write-Host "$($target.Kind) shortcut: $($target.Path)"
}

if (-not $Apply) {
    Write-Host 'WINDOWS SHORTCUT PLAN PASSED'
    Write-Host 'Dry-run only. Re-run with -Apply to create current-user shortcuts.'
    exit 0
}

$shell = New-Object -ComObject WScript.Shell
foreach ($target in $targets) {
    $parent = Split-Path -Parent $target.Path
    if (-not (Test-Path -LiteralPath $parent)) {
        New-Item -ItemType Directory -Force -Path $parent | Out-Null
    }
    if ((Test-Path -LiteralPath $target.Path) -and -not $Force) {
        throw "Refusing to overwrite existing shortcut without -Force: $($target.Path)"
    }

    $shortcut = $shell.CreateShortcut($target.Path)
    $shortcut.TargetPath = $resolvedExe
    $shortcut.WorkingDirectory = $packageDir
    $shortcut.IconLocation = "$resolvedExe,0"
    $shortcut.Description = 'RPGCreatorAI local packaged prototype'
    $shortcut.Save()
    Write-Host "Created $($target.Kind) shortcut: $($target.Path)"
}

Write-Host 'WINDOWS SHORTCUT CREATION PASSED'
