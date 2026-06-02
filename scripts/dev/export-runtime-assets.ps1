$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
& python (Join-Path $PSScriptRoot 'export_runtime_assets.py') --project-root $repoRoot @args
exit $LASTEXITCODE
