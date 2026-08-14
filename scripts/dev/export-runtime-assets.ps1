$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$pythonCommand = 'python'
$pythonPrefix = @()
$probeExit = 0
try { & $pythonCommand -c 'import PIL' 2>$null; $probeExit = $LASTEXITCODE } catch { $probeExit = 1 }
if ($probeExit -ne 0 -and (Get-Command py -ErrorAction SilentlyContinue)) {
    $probeExit = 0
    try { & py -3.14 -c 'import PIL' 2>$null; $probeExit = $LASTEXITCODE } catch { $probeExit = 1 }
    if ($probeExit -eq 0) {
        $pythonCommand = 'py'
        $pythonPrefix = @('-3.14')
    }
}
& $pythonCommand @pythonPrefix (Join-Path $PSScriptRoot 'export_runtime_assets.py') --project-root $repoRoot @args
exit $LASTEXITCODE
