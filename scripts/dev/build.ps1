# scripts/dev/build.ps1
# Configure, build, and run C++ tests only. Skips frontend, desktop, and
# smoke gates from the canonical verifier.
[CmdletBinding()]
param(
    [switch]$Clean,
    [string]$BuildDir
)

$ErrorActionPreference = 'Stop'
& (Join-Path $PSScriptRoot 'verify.ps1') -SkipSmoke -SkipFrontend -SkipDesktop @PSBoundParameters
exit $LASTEXITCODE
