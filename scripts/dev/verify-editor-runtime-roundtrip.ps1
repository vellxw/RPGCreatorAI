[CmdletBinding()]
param(
    [string]$BuildDir
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
Set-Location $repoRoot

function Resolve-BuildDir {
    param([string]$Override)
    if ($Override) { return $Override }
    $localBase = $env:LOCALAPPDATA
    if (-not $localBase) { $localBase = [Environment]::GetFolderPath('LocalApplicationData') }
    if ($localBase) { return Join-Path $localBase 'RPGCreatorAI\build' }
    return Join-Path $repoRoot 'build'
}

function Invoke-Step {
    param(
        [string]$Name,
        [scriptblock]$Script
    )
    Write-Host "=== $Name ==="
    & $Script
}

function Read-ShortLog {
    param([string]$Path)
    if (-not (Test-Path $Path)) { return '' }
    return (Get-Content $Path -Tail 80 -ErrorAction SilentlyContinue) -join [Environment]::NewLine
}

function Get-Sha256FileHash {
    param([string]$Path)
    $stream = [System.IO.File]::OpenRead($Path)
    try {
        $sha = [System.Security.Cryptography.SHA256]::Create()
        try {
            $bytes = $sha.ComputeHash($stream)
            return ([System.BitConverter]::ToString($bytes) -replace '-', '').ToUpperInvariant()
        } finally {
            $sha.Dispose()
        }
    } finally {
        $stream.Dispose()
    }
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
        & (Join-Path $PSScriptRoot 'verify-tauri-content.ps1') -Port 1420 -TimeoutSeconds 5
        if ($LASTEXITCODE -ne 0) {
            throw "Tauri content check failed.`n--- stdout ---`n$(Read-ShortLog $stdout)`n--- stderr ---`n$(Read-ShortLog $stderr)"
        }
    } finally {
        if ($server -and -not $server.HasExited) {
            Stop-Process -Id $server.Id -Force -ErrorAction SilentlyContinue
            $server.WaitForExit()
        }
        Remove-Item $stdout, $stderr -ErrorAction SilentlyContinue
    }
}

function Invoke-RuntimeScreenshotRoundtrip {
    param([string]$ResolvedBuildDir)

    $runtimeExe = Join-Path $ResolvedBuildDir 'rpg_creator_runtime.exe'
    if (-not (Test-Path $runtimeExe)) {
        throw "Runtime executable not found after native build: $runtimeExe"
    }

    $tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("RPGCreatorAI-roundtrip-" + [guid]::NewGuid().ToString('N'))
    $projectRoot = Join-Path $tempRoot 'project'
    $baselineShots = Join-Path $tempRoot 'baseline'
    $editedShots = Join-Path $tempRoot 'edited'

    function Invoke-SmokeShots {
        param(
            [string]$OutputDir,
            [string]$Label
        )
        $logId = [guid]::NewGuid().ToString('N')
        $stdout = Join-Path ([System.IO.Path]::GetTempPath()) "RPGCreatorAI-$Label-$logId.out.log"
        $stderr = Join-Path ([System.IO.Path]::GetTempPath()) "RPGCreatorAI-$Label-$logId.err.log"
        try {
            $proc = Start-Process -FilePath $runtimeExe `
                -ArgumentList @('--smoke-shots', ('"{0}"' -f $OutputDir)) `
                -WorkingDirectory $projectRoot `
                -RedirectStandardOutput $stdout `
                -RedirectStandardError $stderr `
                -PassThru `
                -Wait `
                -WindowStyle Hidden
            $stdoutLines = @(Get-Content $stdout -ErrorAction SilentlyContinue)
            $stderrLines = @(Get-Content $stderr -ErrorAction SilentlyContinue)
            if ($proc.ExitCode -ne 0) {
                throw "$Label runtime smoke failed with exit $($proc.ExitCode):`n--- stdout ---`n$($stdoutLines -join [Environment]::NewLine)`n--- stderr ---`n$($stderrLines -join [Environment]::NewLine)"
            }
            if (($stderrLines -join "`n") -match '\[ERROR\]') {
                throw "$Label runtime smoke emitted [ERROR]:`n--- stderr ---`n$($stderrLines -join [Environment]::NewLine)"
            }
            return @($stdoutLines + $stderrLines)
        } finally {
            Remove-Item $stdout, $stderr -ErrorAction SilentlyContinue
        }
    }

    try {
        New-Item -ItemType Directory -Path $projectRoot | Out-Null
        Copy-Item -Recurse -Force (Join-Path $repoRoot 'data') (Join-Path $projectRoot 'data')
        New-Item -ItemType Directory -Path (Join-Path $projectRoot 'assets\generated') -Force | Out-Null
        New-Item -ItemType Directory -Path (Join-Path $projectRoot 'saves') -Force | Out-Null
        Copy-Item -Recurse -Force (Join-Path $repoRoot 'assets\generated\runtime') (Join-Path $projectRoot 'assets\generated\runtime')

        $baselineLog = Invoke-SmokeShots -OutputDir $baselineShots -Label 'baseline'

        $townPath = Join-Path $projectRoot 'data\maps\town.json'
        $town = Get-Content $townPath -Raw | ConvertFrom-Json
        $visibleTileIndex = 4 * [int]$town.width + 5
        $town.layers[0].tiles[$visibleTileIndex] = 3
        $town | ConvertTo-Json -Depth 32 | Set-Content -Path $townPath -Encoding UTF8

        $editedLog = Invoke-SmokeShots -OutputDir $editedShots -Label 'edited'

        $baselineShot = Join-Path $baselineShots '01-town-initial.bmp'
        $editedShot = Join-Path $editedShots '01-town-initial.bmp'
        $baselineHash = Get-Sha256FileHash $baselineShot
        $editedHash = Get-Sha256FileHash $editedShot

        if ($baselineHash -eq $editedHash) {
            throw 'Runtime round-trip failed: edited town screenshot hash matched baseline.'
        }

        if (($editedLog -join "`n") -notmatch '\[INFO\] Map loaded: town') {
            throw 'Runtime round-trip failed: edited runtime log never loaded town.'
        }

        Write-Host 'OK: editor/runtime screenshot round-trip proof passed.'
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
}

$resolvedBuildDir = Resolve-BuildDir -Override $BuildDir

Invoke-Step 'FRONTEND ROUNDTRIP TESTS' {
    & npm test -- --run src/e2e/__tests__/editorRoundtrip.test.ts src/adapters/__tests__/PlaytestSessionAdapter.test.ts
    if ($LASTEXITCODE -ne 0) { throw "frontend roundtrip tests failed (exit $LASTEXITCODE)" }
}

Invoke-Step 'TAURI CONTENT CHECK' {
    Invoke-TauriContentCheck
}

Invoke-Step 'RUST DESKTOP TESTS' {
    & cargo test --manifest-path src-tauri/Cargo.toml
    if ($LASTEXITCODE -ne 0) { throw "Rust desktop tests failed (exit $LASTEXITCODE)" }
}

Invoke-Step 'NATIVE BUILD AND TEST' {
    & (Join-Path $PSScriptRoot 'verify.ps1') -BuildDir $resolvedBuildDir -SkipSmoke -SkipFrontend -SkipDesktop
}

Invoke-Step 'RUNTIME LAUNCH SMOKE' {
    & (Join-Path $PSScriptRoot 'smoke-runtime.ps1') -BuildDir $resolvedBuildDir
    if ($LASTEXITCODE -ne 0) { throw "runtime launch smoke failed (exit $LASTEXITCODE)" }
}

Invoke-Step 'RUNTIME SCREENSHOT ROUNDTRIP' {
    Invoke-RuntimeScreenshotRoundtrip -ResolvedBuildDir $resolvedBuildDir
}

Write-Host '=== ALL PASSED ==='
Write-Host "Build dir: $resolvedBuildDir"
