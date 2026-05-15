# scripts/dev/build.ps1
# Configure + build only (no tests, no smoke).
[CmdletBinding()]
param([switch]$Clean)

$ErrorActionPreference = 'Stop'
& (Join-Path $PSScriptRoot 'verify.ps1') -SkipSmoke @PSBoundParameters
