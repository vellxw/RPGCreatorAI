param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Args
)

$ErrorActionPreference = "Stop"
$script = Join-Path $PSScriptRoot "generate_animation_preview.py"

python $script @Args
