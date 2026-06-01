# scripts/dev/verify.ps1
# Canonical MVP green gate. Runs frontend, native runtime, desktop/Tauri,
# smoke, and editor-runtime roundtrip validation unless a targeted skip flag
# is provided.

[CmdletBinding()]
param(
    [switch]$Clean,
    [switch]$SkipSmoke,
    [switch]$SkipDesktop,
    [switch]$SkipFrontend,
    [switch]$SkipRuntime,
    [string]$BuildDir
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
Set-Location $repoRoot
$script:GateResults = @()

function Resolve-BuildDir {
    param([string]$Override)
    if ($Override) { return $Override }

    $localBase = $env:LOCALAPPDATA
    if (-not $localBase) { $localBase = [Environment]::GetFolderPath('LocalApplicationData') }
    if ($localBase) { return Join-Path $localBase 'RPGCreatorAI\build' }
    return Join-Path $repoRoot 'build'
}

function Find-Tool {
    param([string[]]$Candidates, [string]$Name)
    foreach ($candidate in $Candidates) {
        if ($candidate -and (Test-Path $candidate)) { return $candidate }
    }
    $cmd = Get-Command $Name -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    throw "Required tool not found: $Name"
}

function Find-VsDevCmd {
    $candidates = @(
        "${env:ProgramFiles}\Microsoft Visual Studio\2022\BuildTools\Common7\Tools\VsDevCmd.bat",
        "${env:ProgramFiles}\Microsoft Visual Studio\2022\Community\Common7\Tools\VsDevCmd.bat",
        "${env:ProgramFiles}\Microsoft Visual Studio\2022\Professional\Common7\Tools\VsDevCmd.bat",
        "${env:ProgramFiles}\Microsoft Visual Studio\2022\Enterprise\Common7\Tools\VsDevCmd.bat",
        "${env:ProgramFiles}\Microsoft Visual Studio\18\Insiders\Common7\Tools\VsDevCmd.bat"
    )
    foreach ($candidate in $candidates) {
        if (Test-Path $candidate) { return $candidate }
    }
    $vsRoot = "${env:ProgramFiles}\Microsoft Visual Studio"
    if (Test-Path $vsRoot) {
        $found = Get-ChildItem -Path $vsRoot -Filter VsDevCmd.bat -Recurse -ErrorAction SilentlyContinue |
            Select-Object -First 1
        if ($found) { return $found.FullName }
    }
    throw "VsDevCmd.bat not found. Install Visual Studio Build Tools or Visual Studio with C++ workload."
}

function Find-CMake {
    $candidates = @(
        "${env:ProgramFiles}\CMake\bin\cmake.exe",
        "${env:ProgramFiles(x86)}\CMake\bin\cmake.exe",
        "${env:LOCALAPPDATA}\Programs\CMake\bin\cmake.exe"
    )
    return Find-Tool $candidates 'cmake'
}

function Find-Ninja {
    $wingetRoot = Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Packages'
    if (Test-Path $wingetRoot) {
        $found = Get-ChildItem -Path $wingetRoot -Filter ninja.exe -Recurse -ErrorAction SilentlyContinue |
            Select-Object -First 1
        if ($found) { return $found.FullName }
    }
    $candidates = @(
        "${env:ProgramFiles}\Ninja\ninja.exe",
        "${env:LOCALAPPDATA}\Programs\Ninja\ninja.exe"
    )
    return Find-Tool $candidates 'ninja'
}

function New-CompatTempBat {
    $tmp = [System.IO.Path]::GetTempFileName()
    $bat = [System.IO.Path]::ChangeExtension($tmp, '.bat')
    Move-Item -Path $tmp -Destination $bat -Force
    return $bat
}

function Add-GateResult {
    param(
        [string]$Name,
        [string]$Status,
        [string]$Detail = ''
    )
    $script:GateResults += [pscustomobject]@{
        Name = $Name
        Status = $Status
        Detail = $Detail
    }
}

function Invoke-Gate {
    param(
        [string]$Name,
        [scriptblock]$Script,
        [string]$SkipReason = ''
    )
    if ($SkipReason) {
        Write-Host "=== $Name (SKIPPED: $SkipReason) ==="
        Add-GateResult $Name 'SKIP' $SkipReason
        return
    }

    Write-Host "=== $Name ==="
    try {
        & $Script
        Add-GateResult $Name 'PASS'
    } catch {
        Add-GateResult $Name 'FAIL' $_.Exception.Message
        Write-Host "FAIL: $Name"
        Write-Host $_.Exception.Message
        throw
    }
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

function Join-SkipReason {
    param([string[]]$Reasons)
    $active = @($Reasons | Where-Object { $_ })
    if ($active.Count -eq 0) { return '' }
    return ($active -join ', ')
}

function Write-GateSummary {
    Write-Host "=== GATE SUMMARY ==="
    foreach ($result in $script:GateResults) {
        if ($result.Detail) {
            Write-Host ("{0}: {1} - {2}" -f $result.Status, $result.Name, $result.Detail)
        } else {
            Write-Host ("{0}: {1}" -f $result.Status, $result.Name)
        }
    }
}

function Read-ShortLog {
    param([string]$Path)
    if (-not (Test-Path $Path)) { return '' }
    return (Get-Content $Path -Tail 80 -ErrorAction SilentlyContinue) -join [Environment]::NewLine
}

function Test-TauriContentQuietly {
    & (Join-Path $PSScriptRoot 'verify-tauri-content.ps1') -Port 1420 -TimeoutSeconds 2 *> $null
    return $LASTEXITCODE -eq 0
}

function Wait-ForTauriDevServer {
    param(
        [System.Diagnostics.Process]$Process,
        [string]$StdoutPath,
        [string]$StderrPath
    )
    $deadline = (Get-Date).AddSeconds(30)
    while ((Get-Date) -lt $deadline) {
        if ($Process.HasExited) {
            throw "Tauri dev server exited before content check passed.`n--- stdout ---`n$(Read-ShortLog $StdoutPath)`n--- stderr ---`n$(Read-ShortLog $StderrPath)"
        }
        try {
            $response = Invoke-WebRequest -Uri 'http://127.0.0.1:1420/' -UseBasicParsing -TimeoutSec 2
            if ($response.StatusCode -eq 200) { return }
        } catch {
            Start-Sleep -Seconds 1
        }
    }
    throw "Timed out waiting for Tauri dev server on http://127.0.0.1:1420/.`n--- stdout ---`n$(Read-ShortLog $StdoutPath)`n--- stderr ---`n$(Read-ShortLog $StderrPath)"
}

function Invoke-TauriContentCheck {
    if (Test-TauriContentQuietly) {
        Write-Host 'OK: existing port 1420 server is serving RPGCreatorAI.'
        return
    }

    $node = (Get-Command node -ErrorAction Stop).Source
    $viteCli = Join-Path $repoRoot 'node_modules\vite\bin\vite.js'
    if (-not (Test-Path $viteCli)) {
        throw "Vite CLI not found at $viteCli. Run npm install first."
    }

    $tempBase = [System.IO.Path]::GetTempPath()
    $logId = [guid]::NewGuid().ToString('N')
    $stdout = Join-Path $tempBase "RPGCreatorAI-vite-$logId.out.log"
    $stderr = Join-Path $tempBase "RPGCreatorAI-vite-$logId.err.log"
    $server = $null
    try {
        $server = Start-Process -FilePath $node `
            -ArgumentList @($viteCli, '--port=1420', '--strictPort', '--host=127.0.0.1') `
            -WorkingDirectory $repoRoot `
            -RedirectStandardOutput $stdout `
            -RedirectStandardError $stderr `
            -PassThru `
            -WindowStyle Hidden

        Wait-ForTauriDevServer -Process $server -StdoutPath $stdout -StderrPath $stderr
        Invoke-CheckedCommand 'Tauri content verification' {
            & (Join-Path $PSScriptRoot 'verify-tauri-content.ps1') -Port 1420 -TimeoutSeconds 5
        }
    } finally {
        if ($server -and -not $server.HasExited) {
            Stop-Process -Id $server.Id -Force -ErrorAction SilentlyContinue
            $server.WaitForExit()
        }
        Remove-Item $stdout, $stderr -ErrorAction SilentlyContinue
    }
}

function Invoke-NativeConfigureBuildTest {
    param([string]$ResolvedBuildDir)

    $cmake = Find-CMake
    $ninja = Find-Ninja
    $vsdev = Find-VsDevCmd

    $buildParent = Split-Path -Parent $ResolvedBuildDir
    if (-not (Test-Path $buildParent)) {
        New-Item -ItemType Directory -Path $buildParent -Force | Out-Null
    }

    Write-Host 'Native tools:'
    Write-Host "  cmake:  $cmake"
    Write-Host "  ninja:  $ninja"
    Write-Host "  vsdev:  $vsdev"
    Write-Host "  build:  $ResolvedBuildDir"
    if ($ResolvedBuildDir -like "$repoRoot*") {
        Write-Host '  NOTE:   build dir is inside the repo (OneDrive may cause locks)'
    }

    if ($Clean -and (Test-Path $ResolvedBuildDir)) {
        Write-Host '--- CLEAN ---'
        Remove-Item -Recurse -Force $ResolvedBuildDir
    }

    $cmakeDir = Split-Path -Parent $cmake
    $ninjaDir = Split-Path -Parent $ninja
    $tmpBat = New-CompatTempBat
    @"
@echo off
call "$vsdev" -arch=x64 -host_arch=x64 -no_logo
if errorlevel 1 exit /b 1
set PATH=$cmakeDir;$ninjaDir;%PATH%

echo --- CONFIGURE ---
cmake -S "$repoRoot" -B "$ResolvedBuildDir" -G Ninja -DCMAKE_POLICY_VERSION_MINIMUM=3.5
if errorlevel 1 exit /b 1

echo --- BUILD ---
cmake --build "$ResolvedBuildDir"
if errorlevel 1 exit /b 1

echo --- TEST ---
ctest --test-dir "$ResolvedBuildDir" --output-on-failure
if errorlevel 1 exit /b 1

exit /b 0
"@ | Set-Content -Path $tmpBat -Encoding ASCII

    try {
        Invoke-CheckedCommand 'native configure/build/test' {
            & cmd /c "$tmpBat"
        }
    } finally {
        Remove-Item $tmpBat -ErrorAction SilentlyContinue
    }
}

$resolvedBuildDir = Resolve-BuildDir -Override $BuildDir
$frontendSkip = ''
$desktopSkip = ''
$runtimeSkip = ''
$smokeSkip = ''
if ($SkipFrontend) { $frontendSkip = 'SkipFrontend' }
if ($SkipDesktop) { $desktopSkip = 'SkipDesktop' }
if ($SkipRuntime) { $runtimeSkip = 'SkipRuntime' }
if ($SkipSmoke) { $smokeSkip = 'SkipSmoke' }
$runtimeSmokeSkip = Join-SkipReason @($runtimeSkip, $smokeSkip)
$roundtripSkip = Join-SkipReason @($frontendSkip, $desktopSkip, $runtimeSkip, $smokeSkip)

try {
    Invoke-Gate 'FRONTEND TYPECHECK' {
        Invoke-CheckedCommand 'npm run typecheck' { & npm run typecheck }
    } $frontendSkip

    Invoke-Gate 'FRONTEND TESTS' {
        Invoke-CheckedCommand 'npm test' { & npm test }
    } $frontendSkip

    Invoke-Gate 'FRONTEND BUILD' {
        Invoke-CheckedCommand 'npm run build' { & npm run build }
    } $frontendSkip

    Invoke-Gate 'NATIVE CONFIGURE BUILD TEST' {
        Invoke-NativeConfigureBuildTest -ResolvedBuildDir $resolvedBuildDir
    } $runtimeSkip

    Invoke-Gate 'TAURI CONTENT CHECK' {
        Invoke-TauriContentCheck
    } $desktopSkip

    Invoke-Gate 'RUST DESKTOP TESTS' {
        Invoke-CheckedCommand 'cargo test --manifest-path src-tauri/Cargo.toml' {
            & cargo test --manifest-path src-tauri/Cargo.toml
        }
    } $desktopSkip

    Invoke-Gate 'RUNTIME SMOKE' {
        Invoke-CheckedCommand 'runtime smoke' {
            & (Join-Path $PSScriptRoot 'smoke-runtime.ps1') -BuildDir $resolvedBuildDir
        }
    } $runtimeSmokeSkip

    Invoke-Gate 'EDITOR RUNTIME ROUNDTRIP' {
        Invoke-CheckedCommand 'editor-runtime roundtrip' {
            & (Join-Path $PSScriptRoot 'verify-editor-runtime-roundtrip.ps1') -BuildDir $resolvedBuildDir
        }
    } $roundtripSkip
} finally {
    Write-GateSummary
}

Write-Host '=== ALL PASSED ==='
Write-Host "Build dir: $resolvedBuildDir"
