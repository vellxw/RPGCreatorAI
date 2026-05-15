# scripts/dev/commit-phase.ps1
# Sanity-checks for build artifacts/secrets, then commits and pushes.

[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)][string]$Message
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
Set-Location $repoRoot

# Refuse if build/ artifacts are staged
$staged = git diff --cached --name-only
$bad = $staged | Where-Object { $_ -match '^build/' -or $_ -match '\.env(?!.example)' -or $_ -match '\.pdb$' -or $_ -match '\.exe$' }
if ($bad) {
    Write-Error "Refusing to commit: build artifacts/secrets staged:`n$($bad -join "`n")"
    exit 1
}

git status --short
git commit -m $Message
if ($LASTEXITCODE -ne 0) { throw "commit failed" }

git push origin HEAD
if ($LASTEXITCODE -ne 0) { throw "push failed" }

git log -1 --oneline
git status --short
