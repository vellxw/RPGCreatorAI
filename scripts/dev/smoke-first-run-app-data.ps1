[CmdletBinding()]
param(
    [string]$PackagedExe,
    [switch]$KeepTemp
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path

if (-not $PackagedExe) {
    $PackagedExe = Join-Path $env:LOCALAPPDATA 'RPGCreatorAI\tauri-target\debug\rpgcreator-shell.exe'
}

if (-not (Test-Path -LiteralPath $PackagedExe)) {
    throw "Packaged executable not found: $PackagedExe. Run npm run desktop:package:windows first."
}

$packageDir = Split-Path -Parent (Resolve-Path -LiteralPath $PackagedExe).Path
$runtimeExe = Join-Path $packageDir 'rpg_creator_runtime.exe'
if (-not (Test-Path -LiteralPath $runtimeExe)) {
    throw "Packaged runtime executable not found beside shell: $runtimeExe"
}

$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("RPGCreatorAI-first-run-" + [guid]::NewGuid().ToString('N'))
$roamingRoot = Join-Path $tempRoot 'AppData\Roaming'
$localRoot = Join-Path $tempRoot 'AppData\Local'
$homeRoot = Join-Path $tempRoot 'Home'
New-Item -ItemType Directory -Force -Path $roamingRoot, $localRoot, $homeRoot | Out-Null

Write-Host '=== FIRST-RUN APP DATA SMOKE ==='
Write-Host "Packaged exe: $PackagedExe"
Write-Host "Temp root:    $tempRoot"
Write-Host "APPDATA:      $roamingRoot"
Write-Host "LOCALAPPDATA: $localRoot"
Write-Host "HOME:         $homeRoot"

$process = $null
try {
    $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
    $startInfo.FileName = (Resolve-Path -LiteralPath $PackagedExe).Path
    $startInfo.WorkingDirectory = $packageDir
    $startInfo.UseShellExecute = $false
    $startInfo.CreateNoWindow = $true
    $startInfo.EnvironmentVariables['APPDATA'] = $roamingRoot
    $startInfo.EnvironmentVariables['LOCALAPPDATA'] = $localRoot
    $startInfo.EnvironmentVariables['HOME'] = $homeRoot

    $process = [System.Diagnostics.Process]::Start($startInfo)
    Start-Sleep -Seconds 5
    if ($process.HasExited) {
        throw "Packaged app exited during first-run smoke with code $($process.ExitCode)"
    }

    $candidateRoots = @(
        (Join-Path $roamingRoot 'RPGCreatorAI'),
        (Join-Path $localRoot 'RPGCreatorAI'),
        (Join-Path $homeRoot '.rpgcreatorai')
    )
    foreach ($candidate in $candidateRoots) {
        if (Test-Path -LiteralPath $candidate) {
            Write-Host "Created app data root: $candidate"
        }
    }

    Write-Host "FIRST-RUN APP DATA SMOKE PASSED pid=$($process.Id)"
}
finally {
    if ($process -and -not $process.HasExited) {
        Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
        $process.WaitForExit()
    }

    if ($KeepTemp) {
        Write-Host "Kept temp root: $tempRoot"
    } else {
        Remove-Item -LiteralPath $tempRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
}
