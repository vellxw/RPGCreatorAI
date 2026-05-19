param(
    [switch]$CheckOnly
)

$ErrorActionPreference = "Stop"
$script = Join-Path $PSScriptRoot "generate_animation_assets.py"

python $script

if ($CheckOnly) {
    git -C (Resolve-Path (Join-Path $PSScriptRoot "..\..")) diff --exit-code -- `
        data/database/animations.json `
        assets/generated/source/phase9_animation `
        assets/generated/web `
        assets/generated/runtime `
        src/assets/generated `
        docs/screenshots/phase-9-animation
}
