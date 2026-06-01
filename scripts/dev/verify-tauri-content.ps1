# scripts/dev/verify-tauri-content.ps1
#
# Regression check for Phase 5: confirms that the Vite dev server bound to
# the Tauri-only port (1420) is actually serving the RPGCreatorAI editor and
# not whatever other project happens to be on a generic port.
#
# Verifies:
#   * port 1420 is reachable
#   * <title> contains "RPGCreatorAI"
#   * the loaded HTML references our entry script (/src/main.tsx)
#
# This catches the silent-port-collision bug that bit us when Vite fell back
# from a generic port and Tauri opened a window for an unrelated app.
#
# Returns exit code 0 on pass, non-zero on fail. Designed to be called from
# a CI pipeline or before/after a Tauri dev session.

[CmdletBinding()]
param(
    [int]$Port = 1420,
    [int]$TimeoutSeconds = 20
)

$ErrorActionPreference = 'Stop'
$url = "http://127.0.0.1:$Port/"

try {
    $resp = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec $TimeoutSeconds
} catch {
    Write-Host "FAIL: cannot reach $url ($($_.Exception.Message))"
    exit 1
}

if ($resp.StatusCode -ne 200) {
    Write-Host "FAIL: $url returned HTTP $($resp.StatusCode)"
    exit 1
}

$body = $resp.Content

$failed = @()
$expected = @(
    @{ name = 'page title';     pattern = '<title>RPGCreatorAI' },
    @{ name = 'editor entry';   pattern = '/src/main.tsx' }
)

foreach ($check in $expected) {
    if ($body -notmatch [regex]::Escape($check.pattern)) {
        $failed += "$($check.name) (expected pattern: $($check.pattern))"
    }
}

if ($failed.Count -gt 0) {
    Write-Host 'FAIL: Vite dev server is reachable but serving the wrong app.'
    foreach ($f in $failed) { Write-Host "  - missing $f" }
    Write-Host '--- response head ---'
    Write-Host ($body.Substring(0, [Math]::Min(400, $body.Length)))
    exit 1
}

Write-Host "OK: $url is serving the RPGCreatorAI editor."
exit 0
