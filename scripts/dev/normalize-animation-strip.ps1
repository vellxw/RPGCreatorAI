param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Args
)

$ErrorActionPreference = "Stop"
$script = Join-Path $PSScriptRoot "normalize_animation_strip.py"

python $script @Args
