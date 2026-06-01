[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
Set-Location $repoRoot

function Invoke-CheckedCommand {
    param(
        [string]$Label,
        [scriptblock]$Command
    )

    Write-Host "=== $Label ==="
    & $Command
    if ($LASTEXITCODE -ne 0) {
        throw "$Label failed (exit $LASTEXITCODE)"
    }
}

Write-Host '=== RUNTIME DIAGNOSTICS VERIFY ==='
Write-Host "Repo: $repoRoot"

Invoke-CheckedCommand 'SAFE FAILURE PATH: EMPTY RUNTIME LOG DIRECTORY' {
    & cargo test --manifest-path src-tauri/Cargo.toml runtime_commands::tests::runtime_diagnostics_reports_folder_without_existing_log -- --exact
}

Invoke-CheckedCommand 'DIAGNOSTICS UI AND ADAPTER TESTS' {
    & npm test -- --run src/adapters/__tests__/DesktopRuntimeAdapter.test.ts src/components/playtest/__tests__/RuntimeLogPanel.test.tsx
}

Invoke-CheckedCommand 'FRONTEND TYPECHECK' {
    & npm run typecheck
}

Write-Host 'RUNTIME DIAGNOSTICS VERIFY PASSED'
