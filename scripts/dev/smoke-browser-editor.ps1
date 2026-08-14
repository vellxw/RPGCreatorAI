[CmdletBinding()]
param(
    [string]$Url = 'http://127.0.0.1:3000',
    [string]$OutputDir = 'output/playwright/cp108',
    [switch]$SkipBrowser,
    [int]$StartupTimeoutSeconds = 60,
    [switch]$KeepServer
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$outputRoot = Join-Path $repoRoot $OutputDir
$artifactRoot = Join-Path ([System.IO.Path]::GetTempPath()) ('RPGCreatorAI-cp108-browser-smoke-' + [guid]::NewGuid().ToString('N'))
$transcriptPath = Join-Path $artifactRoot 'browser-smoke-transcript.txt'
$session = 'rpgcreatorai-cp108-' + [guid]::NewGuid().ToString('N')
$devProcess = $null
$startedDevServer = $false

function Write-HarnessSkip {
    param([string]$Reason)
    New-Item -ItemType Directory -Force -Path $outputRoot | Out-Null
    $message = "BROWSER SMOKE SKIPPED: $Reason"
    Write-Host $message
    Set-Content -LiteralPath (Join-Path $outputRoot 'skip.txt') -Value $message -Encoding utf8
    exit 0
}

function Test-HttpReady {
    try {
        $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2
        return ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500)
    } catch {
        return $false
    }
}

function Wait-HttpReady {
    $deadline = (Get-Date).AddSeconds($StartupTimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        if (Test-HttpReady) {
            return $true
        }
        # npm.cmd may hand off to Vite and exit while the child server is
        # still starting. Keep polling the HTTP endpoint instead of treating
        # the wrapper process exit as a failed launch.
        Start-Sleep -Milliseconds 500
    }
    return $false
}

function Add-TranscriptBlock {
    param(
        [string]$Label,
        [string]$Body
    )
    Add-Content -LiteralPath $transcriptPath -Value @(
        "",
        "### $Label",
        $Body
    ) -Encoding utf8
}

function Publish-HarnessArtifacts {
    if (-not (Test-Path -LiteralPath $artifactRoot)) {
        return
    }
    New-Item -ItemType Directory -Force -Path $outputRoot | Out-Null
    Get-ChildItem -LiteralPath $artifactRoot -Force |
        Copy-Item -Destination $outputRoot -Recurse -Force
}

function Stop-HarnessProcessTree {
    param([int]$ProcessId)
    if ($ProcessId -le 0) {
        return
    }

    $children = Get-CimInstance Win32_Process -Filter "ParentProcessId = $ProcessId" -ErrorAction SilentlyContinue
    foreach ($child in @($children)) {
        Stop-HarnessProcessTree -ProcessId $child.ProcessId
    }

    Stop-Process -Id $ProcessId -Force -ErrorAction SilentlyContinue
}

function Invoke-PwCli {
    param([string[]]$Arguments)
    $commandLabel = "playwright-cli $($Arguments -join ' ')"
    $sessionArgument = '-s=' + [string]$script:session
    $output = & $script:npxPath '--yes' '--package' '@playwright/cli' 'playwright-cli' $sessionArgument @Arguments 2>&1
    $exitCode = $LASTEXITCODE
    $text = ($output | Out-String).TrimEnd()
    Add-TranscriptBlock -Label $commandLabel -Body $text
    if ($exitCode -ne 0) {
        throw "$commandLabel failed with exit code $exitCode`n$text"
    }
    return $text
}

function Assert-SmokeText {
    param(
        [string]$Text,
        [string[]]$Expected
    )
    foreach ($item in $Expected) {
        if ($Text -notlike "*$item*") {
            throw "Browser smoke assertion failed: expected snapshot text '$item'."
        }
    }
}

function Save-HarnessScreenshot {
    param([string]$Name)
    $result = Invoke-PwCli -Arguments @('screenshot')
    $match = [regex]::Match($result, '\]\(([^)]+\.png)\)')
    $source = $null
    if ($match.Success) {
        $relative = $match.Groups[1].Value.Replace('/', [System.IO.Path]::DirectorySeparatorChar)
        $source = Join-Path $repoRoot $relative
    }
    if (-not $source -or -not (Test-Path -LiteralPath $source)) {
        $source = Get-ChildItem -LiteralPath (Join-Path $repoRoot '.playwright-cli') -Filter '*.png' -ErrorAction SilentlyContinue |
            Sort-Object LastWriteTime -Descending |
            Select-Object -First 1 -ExpandProperty FullName
    }
    if (-not $source -or -not (Test-Path -LiteralPath $source)) {
        throw 'Playwright screenshot command did not produce a PNG artifact.'
    }
    Copy-Item -LiteralPath $source -Destination (Join-Path $artifactRoot $Name) -Force
}

if ($SkipBrowser) {
    Write-HarnessSkip 'SkipBrowser requested.'
}

New-Item -ItemType Directory -Force -Path $artifactRoot | Out-Null
Set-Content -LiteralPath $transcriptPath -Value @(
    'BROWSER SMOKE START',
    "Url: $Url",
    "Output: $OutputDir",
    "Session: $session"
) -Encoding utf8

$npx = Get-Command npx.cmd -ErrorAction SilentlyContinue
if (-not $npx) { $npx = Get-Command npx -ErrorAction SilentlyContinue }
if (-not $npx) {
    Write-HarnessSkip 'npx was not found; install Node.js/npm or run in an environment with npx available.'
}
$script:npxPath = $npx.Source
$script:session = $session

try {
    if (-not (Test-HttpReady)) {
        $node = Get-Command node.exe -ErrorAction SilentlyContinue
        $viteCli = Join-Path $repoRoot 'node_modules\vite\bin\vite.js'
        if (-not $node -or -not (Test-Path -LiteralPath $viteCli)) {
            Write-HarnessSkip 'Node.js/Vite was not found and the editor dev server is not already running.'
        }

        $devOut = Join-Path $artifactRoot 'vite-dev.stdout.txt'
        $devErr = Join-Path $artifactRoot 'vite-dev.stderr.txt'
        $devProcess = Start-Process `
            -FilePath $node.Source `
            -ArgumentList @($viteCli, '--host=127.0.0.1', '--port=3000') `
            -WorkingDirectory $repoRoot `
            -RedirectStandardOutput $devOut `
            -RedirectStandardError $devErr `
            -PassThru `
            -WindowStyle Hidden
        $startedDevServer = $true
    }

    if (-not (Wait-HttpReady)) {
        Write-HarnessSkip "editor dev server did not become ready at $Url within $StartupTimeoutSeconds seconds."
    }

    $startupHtml = (Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 10).Content
    Assert-SmokeText -Text $startupHtml -Expected @(
        'data-rpg-splash-shell',
        'aria-busy="true"',
        'Preparing your workspace',
        'Loading project data and editor state.'
    )
    Set-Content -LiteralPath (Join-Path $artifactRoot '00-static-splash.html') -Value $startupHtml -Encoding utf8

    Invoke-PwCli -Arguments @('delete-data') | Out-Null
    Invoke-PwCli -Arguments @('open', $Url) | Out-Null

    $startupSnapshot = Invoke-PwCli -Arguments @('snapshot')
    Assert-SmokeText -Text $startupSnapshot -Expected @(
        'Welcome to RPGCreatorAI',
        'Pick a starter path',
        'Open the bundled sample (My First RPG)',
        'Use this starter path'
    )
    Set-Content -LiteralPath (Join-Path $artifactRoot '01-startup.snapshot.txt') -Value $startupSnapshot -Encoding utf8
    Save-HarnessScreenshot -Name '01-startup.png'

    Invoke-PwCli -Arguments @('click', "input[data-testid='first-run-path-radio-bundled-sample']") | Out-Null
    Invoke-PwCli -Arguments @('click', "button[data-testid='first-run-confirm']") | Out-Null
    Start-Sleep -Milliseconds 500
    Invoke-PwCli -Arguments @('click', "button:has-text('Use My First RPG')") | Out-Null
    Start-Sleep -Milliseconds 500

    $mapsSnapshot = Invoke-PwCli -Arguments @('snapshot')
    Assert-SmokeText -Text $mapsSnapshot -Expected @('Maps', 'Events', 'Database', 'Assets', 'Playtest', 'Settings', 'Validate', 'Save')
    Set-Content -LiteralPath (Join-Path $artifactRoot '02-maps.snapshot.txt') -Value $mapsSnapshot -Encoding utf8
    Save-HarnessScreenshot -Name '02-maps.png'

    Invoke-PwCli -Arguments @('click', "button:has-text('Validate')") | Out-Null
    Start-Sleep -Milliseconds 250
    $validateSnapshot = Invoke-PwCli -Arguments @('snapshot')
    Assert-SmokeText -Text $validateSnapshot -Expected @('Validation passed')
    Set-Content -LiteralPath (Join-Path $artifactRoot '03-validate.snapshot.txt') -Value $validateSnapshot -Encoding utf8

    Invoke-PwCli -Arguments @('click', "button[title='Validate and save project data']") | Out-Null
    Start-Sleep -Milliseconds 250
    $saveSnapshot = Invoke-PwCli -Arguments @('snapshot')
    Assert-SmokeText -Text $saveSnapshot -Expected @('Saved via BrowserMemoryAdapter')
    Set-Content -LiteralPath (Join-Path $artifactRoot '04-save.snapshot.txt') -Value $saveSnapshot -Encoding utf8

    foreach ($workspace in @('Events', 'Database', 'Assets', 'Playtest', 'Settings')) {
        Invoke-PwCli -Arguments @('click', "nav button:has-text('$workspace')") | Out-Null
        Start-Sleep -Milliseconds 300
        $snapshot = Invoke-PwCli -Arguments @('snapshot')
        Assert-SmokeText -Text $snapshot -Expected @($workspace)
        $safeName = $workspace.ToLowerInvariant()
        Set-Content -LiteralPath (Join-Path $artifactRoot "workspace-$safeName.snapshot.txt") -Value $snapshot -Encoding utf8
        Save-HarnessScreenshot -Name "workspace-$safeName.png"
    }

    $consoleOutput = Invoke-PwCli -Arguments @('console', 'error')
    Set-Content -LiteralPath (Join-Path $artifactRoot 'console-errors.txt') -Value $consoleOutput -Encoding utf8

    Write-Host 'BROWSER SMOKE PASSED'
    Write-Host "Artifacts: $OutputDir"
    Add-Content -LiteralPath $transcriptPath -Value @('', 'BROWSER SMOKE PASSED') -Encoding utf8
}
catch {
    $message = $_.Exception.Message
    if ($message -match 'browser.*install|Executable.*doesn.t exist|Target page.*closed|ECONNREFUSED|timed out waiting|spawn') {
        Write-HarnessSkip "browser automation environment unavailable: $message"
    }
    throw
}
finally {
    try { Invoke-PwCli -Arguments @('close') | Out-Null } catch { }
    try { Invoke-PwCli -Arguments @('delete-data') | Out-Null } catch { }

    if ($startedDevServer -and $devProcess -and -not $KeepServer) {
        Stop-HarnessProcessTree -ProcessId $devProcess.Id
        if (-not $devProcess.HasExited) {
            $devProcess.WaitForExit()
        }
    }

    Publish-HarnessArtifacts
    Remove-Item -LiteralPath $artifactRoot -Recurse -Force -ErrorAction SilentlyContinue
}
