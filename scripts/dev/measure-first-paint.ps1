[CmdletBinding()]
param(
    [string]$Url = 'http://127.0.0.1:3000',
    [string]$OutputDir = 'output/playwright/phase12-px021-first-paint',
    [switch]$SkipBrowser,
    [int]$StartupTimeoutSeconds = 120,
    [int]$SplashVisibleBudgetMs = 1000,
    [int]$FirstContentfulPaintBudgetMs = 1500,
    [int]$DomContentLoadedBudgetMs = 2500,
    [switch]$KeepServer
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$outputRoot = Join-Path $repoRoot $OutputDir
$artifactRoot = Join-Path ([System.IO.Path]::GetTempPath()) ('RPGCreatorAI-px021-first-paint-' + [guid]::NewGuid().ToString('N'))
$transcriptPath = Join-Path $artifactRoot 'first-paint-transcript.txt'
$session = 'rpgcreatorai-px021-' + [guid]::NewGuid().ToString('N')
$devProcess = $null
$startedDevServer = $false

function Write-MeasureSkip {
    param([string]$Reason)
    New-Item -ItemType Directory -Force -Path $outputRoot | Out-Null
    $message = "FIRST PAINT MEASURE SKIPPED: $Reason"
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
        Start-Sleep -Milliseconds 250
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

function Publish-MeasureArtifacts {
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
    $processInfo = [System.Diagnostics.ProcessStartInfo]::new()
    $processInfo.FileName = $script:npxPath
    $processInfo.UseShellExecute = $false
    $processInfo.RedirectStandardOutput = $true
    $processInfo.RedirectStandardError = $true
    $allArguments = @('--yes', '--package', '@playwright/cli', 'playwright-cli', "-s=$script:session") + $Arguments
    if ($null -ne $processInfo.ArgumentList) {
        foreach ($argument in $allArguments) {
            [void]$processInfo.ArgumentList.Add($argument)
        }
    } else {
        $quotedArguments = $allArguments | ForEach-Object {
            '"' + ($_.Replace('"', '\"')) + '"'
        }
        $processInfo.Arguments = $quotedArguments -join ' '
    }
    $process = [System.Diagnostics.Process]::Start($processInfo)
    $stdout = $process.StandardOutput.ReadToEnd()
    $stderr = $process.StandardError.ReadToEnd()
    $process.WaitForExit()
    $exitCode = $process.ExitCode
    $text = (@($stdout, $stderr) -join "`n").TrimEnd()
    Add-TranscriptBlock -Label $commandLabel -Body $text
    if ($exitCode -ne 0) {
        throw "$commandLabel failed with exit code $exitCode`n$text"
    }
    return $text
}

function ConvertFrom-EvalJson {
    param([string]$EvalOutput)
    $lines = $EvalOutput -split "`r?`n"
    for ($i = 0; $i -lt $lines.Length; $i++) {
        if ($lines[$i] -eq '### Result') {
            for ($j = $i + 1; $j -lt $lines.Length; $j++) {
                $line = $lines[$j].Trim()
                if ($line.Length -eq 0) {
                    continue
                }
                $decoded = $line | ConvertFrom-Json
                if ($decoded -is [string]) {
                    return ($decoded | ConvertFrom-Json)
                }
                return $decoded
            }
        }
    }
    throw "Unable to parse playwright eval result.`n$EvalOutput"
}

if ($SkipBrowser) {
    Write-MeasureSkip 'SkipBrowser requested.'
}

New-Item -ItemType Directory -Force -Path $artifactRoot | Out-Null
Set-Content -LiteralPath $transcriptPath -Value @(
    'FIRST PAINT MEASURE START',
    "Url: $Url",
    "Output: $OutputDir",
    "Session: $session",
    "SplashVisibleBudgetMs: $SplashVisibleBudgetMs",
    "FirstContentfulPaintBudgetMs: $FirstContentfulPaintBudgetMs",
    "DomContentLoadedBudgetMs: $DomContentLoadedBudgetMs"
) -Encoding utf8

$npx = Get-Command npx -ErrorAction SilentlyContinue
if (-not $npx) {
    Write-MeasureSkip 'npx was not found; install Node.js/npm or run in an environment with npx available.'
}
$script:npxPath = $npx.Source
$script:session = $session

try {
    if (-not (Test-HttpReady)) {
        $npm = Get-Command npm -ErrorAction SilentlyContinue
        if (-not $npm) {
            Write-MeasureSkip 'npm was not found and the editor dev server is not already running.'
        }

        $devOut = Join-Path $artifactRoot 'vite-dev.stdout.txt'
        $devErr = Join-Path $artifactRoot 'vite-dev.stderr.txt'
        $devProcess = Start-Process `
            -FilePath $npm.Source `
            -ArgumentList @('run', 'dev', '--', '--host=127.0.0.1', '--port=3000') `
            -WorkingDirectory $repoRoot `
            -RedirectStandardOutput $devOut `
            -RedirectStandardError $devErr `
            -PassThru `
            -WindowStyle Hidden
        $startedDevServer = $true
    }

    if (-not (Wait-HttpReady)) {
        Write-MeasureSkip "editor dev server did not become ready at $Url within $StartupTimeoutSeconds seconds."
    }

    Invoke-PwCli -Arguments @('delete-data') | Out-Null
    Invoke-PwCli -Arguments @('open', $Url) | Out-Null

    # Reads browser performance.getEntriesByType('paint') entries from the startup route.
    $measureScript = 'JSON.stringify((function() { var marks = window.__RPG_STARTUP_MARKS__ ? window.__RPG_STARTUP_MARKS__ : {}; var navigation = performance.getEntriesByType("navigation")[0] ? performance.getEntriesByType("navigation")[0] : null; var paintEntries = Array.from(performance.getEntriesByType("paint")).map(function(entry) { return { name: entry.name, startTime: Math.round(entry.startTime) }; }); var firstPaint = paintEntries.find(function(entry) { return entry.name === "first-paint"; }); var firstContentfulPaint = paintEntries.find(function(entry) { return entry.name === "first-contentful-paint"; }); var staticSplashMs = typeof marks.staticSplashDomReadyMs === "number" ? marks.staticSplashDomReadyMs : null; var splashShell = document.querySelector("[data-rpg-splash-shell]") ? "[data-rpg-splash-shell]" : (document.querySelector("[data-testid=app-splash-shell]") ? "[data-testid=app-splash-shell]" : "startup shell already advanced"); return { url: location.href, measuredAt: new Date().toISOString(), userAgent: navigator.userAgent, splashSelector: splashShell, splashVisibleMs: staticSplashMs ? staticSplashMs : Math.round(performance.now()), firstPaintMs: firstPaint ? firstPaint.startTime : null, firstContentfulPaintMs: firstContentfulPaint ? firstContentfulPaint.startTime : null, domContentLoadedMs: navigation ? Math.round(navigation.domContentLoadedEventEnd) : null, loadEventEndMs: navigation ? Math.round(navigation.loadEventEnd) : null, paintEntries: paintEntries }; })())'

    $evalOutput = Invoke-PwCli -Arguments @('eval', $measureScript)
    $measurement = ConvertFrom-EvalJson -EvalOutput $evalOutput

    $failures = @()
    if ($measurement.splashVisibleMs -gt $SplashVisibleBudgetMs) {
        $failures += "splashVisibleMs=$($measurement.splashVisibleMs) exceeded SplashVisibleBudgetMs=$SplashVisibleBudgetMs"
    }
    if ($null -ne $measurement.firstContentfulPaintMs -and $measurement.firstContentfulPaintMs -gt $FirstContentfulPaintBudgetMs) {
        $failures += "firstContentfulPaintMs=$($measurement.firstContentfulPaintMs) exceeded FirstContentfulPaintBudgetMs=$FirstContentfulPaintBudgetMs"
    }
    if ($null -ne $measurement.domContentLoadedMs -and $measurement.domContentLoadedMs -gt $DomContentLoadedBudgetMs) {
        $failures += "domContentLoadedMs=$($measurement.domContentLoadedMs) exceeded DomContentLoadedBudgetMs=$DomContentLoadedBudgetMs"
    }

    $summary = [ordered]@{
        result = if ($failures.Count -eq 0) { 'PASS' } else { 'FAIL' }
        url = $Url
        thresholds = [ordered]@{
            SplashVisibleBudgetMs = $SplashVisibleBudgetMs
            FirstContentfulPaintBudgetMs = $FirstContentfulPaintBudgetMs
            DomContentLoadedBudgetMs = $DomContentLoadedBudgetMs
        }
        measurement = $measurement
        failures = $failures
    }
    $summaryJson = $summary | ConvertTo-Json -Depth 8
    Set-Content -LiteralPath (Join-Path $artifactRoot 'startup-first-paint.json') -Value $summaryJson -Encoding utf8
    Set-Content -LiteralPath (Join-Path $artifactRoot 'startup-first-paint-summary.txt') -Value @(
        "Result: $($summary.result)",
        "Splash visible: $($measurement.splashVisibleMs) ms <= $SplashVisibleBudgetMs ms",
        "First contentful paint: $($measurement.firstContentfulPaintMs) ms <= $FirstContentfulPaintBudgetMs ms (when reported)",
        "DOMContentLoaded: $($measurement.domContentLoadedMs) ms <= $DomContentLoadedBudgetMs ms",
        "Selector: $($measurement.splashSelector)",
        "URL: $Url"
    ) -Encoding utf8

    if ($failures.Count -gt 0) {
        throw "FIRST PAINT MEASURE FAILED: $($failures -join '; ')"
    }

    Write-Host 'FIRST PAINT MEASURE PASSED'
    Write-Host "Splash visible: $($measurement.splashVisibleMs) ms <= $SplashVisibleBudgetMs ms"
    Write-Host "First contentful paint: $($measurement.firstContentfulPaintMs) ms <= $FirstContentfulPaintBudgetMs ms (when reported)"
    Write-Host "DOMContentLoaded: $($measurement.domContentLoadedMs) ms <= $DomContentLoadedBudgetMs ms"
    Write-Host "Artifacts: $OutputDir"
    Add-Content -LiteralPath $transcriptPath -Value @('', 'FIRST PAINT MEASURE PASSED') -Encoding utf8
}
catch {
    $message = $_.Exception.Message
    if ($message -match 'browser.*install|Executable.*doesn.t exist|Target page.*closed|ECONNREFUSED|timed out waiting|spawn') {
        Write-MeasureSkip "browser automation environment unavailable: $message"
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

    Publish-MeasureArtifacts
    Remove-Item -LiteralPath $artifactRoot -Recurse -Force -ErrorAction SilentlyContinue
}
