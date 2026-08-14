[CmdletBinding()]
param(
    [string]$ToolchainContractPath = '',
    [string]$ProjectRoot = '',
    [Alias('JavaHome')]
    [string]$JavaHomePath = '',
    [string]$GradleExecutable = '',
    [switch]$Generate,
    [switch]$Force
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
Set-StrictMode -Version Latest

$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
if ([string]::IsNullOrWhiteSpace($ToolchainContractPath)) {
    $ToolchainContractPath = Join-Path $repoRoot 'src\platform\android\toolchain\android-toolchain.v1.json'
}

function Resolve-RepoPath([string]$Path) {
    if ([IO.Path]::IsPathRooted($Path)) { return [IO.Path]::GetFullPath($Path) }
    return [IO.Path]::GetFullPath((Join-Path $repoRoot $Path))
}

function Read-JsonFile([string]$Path, [string]$Label) {
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { throw "$Label is missing: $Path" }
    try { return [IO.File]::ReadAllText($Path) | ConvertFrom-Json } catch { throw "$Label is invalid JSON: $($_.Exception.Message)" }
}

function Get-LowerSha256([string]$Path) {
    return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

function Write-Utf8NoBom([string]$Path, [string]$Value) {
    $parent = Split-Path -Parent $Path
    if ($parent) { [IO.Directory]::CreateDirectory($parent) | Out-Null }
    [IO.File]::WriteAllText($Path, $Value + [Environment]::NewLine, [Text.UTF8Encoding]::new($false))
}

function Get-JavaMajor([string]$JavaHomeValue) {
    $releasePath = Join-Path $JavaHomeValue 'release'
    if (-not (Test-Path -LiteralPath (Join-Path $JavaHomeValue 'bin\java.exe') -PathType Leaf) -or -not (Test-Path -LiteralPath $releasePath -PathType Leaf)) { return -1 }
    $match = [Text.RegularExpressions.Regex]::Match([IO.File]::ReadAllText($releasePath), '(?m)^JAVA_VERSION="(?:1\.)?(\d+)')
    if (-not $match.Success) { return -1 }
    return [int]$match.Groups[1].Value
}

$contractPath = Resolve-RepoPath $ToolchainContractPath
$contract = Read-JsonFile $contractPath 'Android toolchain contract'
if ($contract.schemaVersion -ne 1) { throw 'Android toolchain contract schemaVersion must be 1.' }
if ([string]::IsNullOrWhiteSpace($ProjectRoot)) { $ProjectRoot = Resolve-RepoPath ([string]$contract.canonicalProjectRoot) }
else { $ProjectRoot = [IO.Path]::GetFullPath($ProjectRoot) }
if (-not (Test-Path -LiteralPath (Join-Path $ProjectRoot 'settings.gradle.kts') -PathType Leaf) -or -not (Test-Path -LiteralPath (Join-Path $ProjectRoot 'build.gradle.kts') -PathType Leaf)) {
    throw "ProjectRoot is not the canonical Gradle scaffold: $ProjectRoot"
}

$required = @($contract.gradle.requiredWrapperFiles | ForEach-Object { [string]$_ })
$present = @($required | Where-Object { Test-Path -LiteralPath (Join-Path $ProjectRoot $_.Replace('/', [IO.Path]::DirectorySeparatorChar)) -PathType Leaf })
$fixturePath = Resolve-RepoPath ([string]$contract.gradle.wrapperPropertiesFixture)
$inventoryPath = Join-Path $ProjectRoot ([string]$contract.gradle.wrapperInventory).Replace('/', [IO.Path]::DirectorySeparatorChar)

function Test-Wrapper([switch]$ThrowOnFailure) {
    $errors = [Collections.Generic.List[string]]::new()
    foreach ($relative in $required) {
        if (-not (Test-Path -LiteralPath (Join-Path $ProjectRoot $relative.Replace('/', [IO.Path]::DirectorySeparatorChar)) -PathType Leaf)) { $errors.Add("missing $relative") }
    }
    $propertiesPath = Join-Path $ProjectRoot 'gradle\wrapper\gradle-wrapper.properties'
    if (-not (Test-Path -LiteralPath $fixturePath -PathType Leaf)) { $errors.Add('missing pinned properties fixture') }
    elseif (-not (Test-Path -LiteralPath $propertiesPath -PathType Leaf)) { $errors.Add('missing gradle-wrapper.properties') }
    elseif ((Get-LowerSha256 $fixturePath) -cne (Get-LowerSha256 $propertiesPath)) { $errors.Add('gradle-wrapper.properties differs from pinned fixture') }
    if (-not (Test-Path -LiteralPath $inventoryPath -PathType Leaf)) { $errors.Add('missing wrapper-files.sha256.json') }
    else {
        try {
            $inventory = Read-JsonFile $inventoryPath 'Gradle wrapper inventory'
            if ($inventory.schemaVersion -ne 1 -or [string]$inventory.gradleVersion -cne [string]$contract.gradle.version) { $errors.Add('wrapper inventory schema/version mismatch') }
            $inventoryRecords = @($inventory.files)
            if ($inventoryRecords.Count -ne $required.Count) { $errors.Add('wrapper inventory must contain exactly the required wrapper files') }
            foreach ($relative in $required) {
                $record = @($inventoryRecords | Where-Object { [string]$_.path -ceq $relative })
                $path = Join-Path $ProjectRoot $relative.Replace('/', [IO.Path]::DirectorySeparatorChar)
                if ($record.Count -ne 1) { $errors.Add("inventory must contain exactly one record for $relative"); continue }
                if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { continue }
                if ([string]$record[0].sha256 -cne (Get-LowerSha256 $path) -or [long]$record[0].bytes -ne (Get-Item -LiteralPath $path).Length) { $errors.Add("inventory mismatch for $relative") }
            }
        } catch { $errors.Add($_.Exception.Message) }
    }
    if ($ThrowOnFailure -and $errors.Count -gt 0) { throw "Gradle wrapper validation failed: $($errors -join '; ')" }
    return @($errors)
}

if (-not $Generate) {
    $errors = @(Test-Wrapper)
    if ($errors.Count -eq 0) {
        Write-Host "Gradle $($contract.gradle.version) wrapper is complete and checksum-bound at: $ProjectRoot"
        exit 0
    }
    Write-Host "Gradle wrapper is not ready: $($errors -join '; ')"
    Write-Host 'Validation mode did not run Gradle or change any file. Re-run with -Generate and an explicit Gradle executable only after JDK 17 is configured.'
    exit 3
}

$existingErrors = @()
if ($present.Count -eq $required.Count) { $existingErrors = @(Test-Wrapper) }
if ($present.Count -eq $required.Count -and $existingErrors.Count -eq 0) {
    Write-Host "Gradle $($contract.gradle.version) wrapper is already complete and checksum-bound at: $ProjectRoot"
    exit 0
}
if ($present.Count -eq $required.Count -and $existingErrors.Count -gt 0 -and -not $Force) {
    throw "A complete but invalid wrapper exists. Inspect it, then rerun with -Force: $($existingErrors -join '; ')"
}

if ([string]::IsNullOrWhiteSpace($JavaHomePath)) { $JavaHomePath = [Environment]::GetEnvironmentVariable('JAVA_HOME') }
if ([string]::IsNullOrWhiteSpace($JavaHomePath)) { throw 'Wrapper generation requires -JavaHomePath (or -JavaHome) or JAVA_HOME pointing to JDK 17.' }
$JavaHomePath = [IO.Path]::GetFullPath($JavaHomePath)
if ((Get-JavaMajor $JavaHomePath) -ne [int]$contract.java.requiredMajor) { throw "Wrapper generation requires JDK $($contract.java.requiredMajor): $JavaHomePath" }
if ([string]::IsNullOrWhiteSpace($GradleExecutable)) { throw '-GradleExecutable is mandatory in -Generate mode; PATH discovery is intentionally disabled.' }
$GradleExecutable = [IO.Path]::GetFullPath($GradleExecutable)
if (-not (Test-Path -LiteralPath $GradleExecutable -PathType Leaf)) { throw "Gradle executable does not exist: $GradleExecutable" }
if ([IO.Path]::GetExtension($GradleExecutable) -notin @('.bat', '.cmd', '.exe')) { throw 'On Windows, -GradleExecutable must be an explicit .bat, .cmd, or .exe file.' }

if ($present.Count -gt 0 -and $present.Count -lt $required.Count -and -not $Force) {
    throw "A partial wrapper exists ($($present.Count)/$($required.Count)). Inspect it, then rerun with -Force to replace only the wrapper files."
}
if ($Force) {
    foreach ($relative in @($required + @([string]$contract.gradle.wrapperInventory))) {
        $path = Join-Path $ProjectRoot $relative.Replace('/', [IO.Path]::DirectorySeparatorChar)
        if (Test-Path -LiteralPath $path -PathType Leaf) { Remove-Item -LiteralPath $path -Force }
    }
}

$previousJavaHome = [Environment]::GetEnvironmentVariable('JAVA_HOME', 'Process')
$previousLocation = Get-Location
try {
    [Environment]::SetEnvironmentVariable('JAVA_HOME', $JavaHomePath, 'Process')
    Set-Location -LiteralPath $ProjectRoot
    & $GradleExecutable '--no-daemon' 'wrapper' '--gradle-version' ([string]$contract.gradle.version) '--distribution-type' ([string]$contract.gradle.distributionType) '--no-validate-url'
    if ($LASTEXITCODE -ne 0) { throw "Gradle wrapper generation failed with exit code $LASTEXITCODE." }
} finally {
    Set-Location -LiteralPath $previousLocation
    [Environment]::SetEnvironmentVariable('JAVA_HOME', $previousJavaHome, 'Process')
}

$propertiesTarget = Join-Path $ProjectRoot 'gradle\wrapper\gradle-wrapper.properties'
[IO.Directory]::CreateDirectory((Split-Path -Parent $propertiesTarget)) | Out-Null
[IO.File]::WriteAllBytes($propertiesTarget, [IO.File]::ReadAllBytes($fixturePath))

$records = foreach ($relative in $required) {
    $path = Join-Path $ProjectRoot $relative.Replace('/', [IO.Path]::DirectorySeparatorChar)
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "Gradle did not generate required wrapper file: $relative" }
    [ordered]@{ path = $relative; bytes = (Get-Item -LiteralPath $path).Length; sha256 = Get-LowerSha256 $path }
}
$inventory = [ordered]@{
    schemaVersion = 1
    gradleVersion = [string]$contract.gradle.version
    distributionUrl = [string]$contract.gradle.distributionUrl
    distributionSha256Sum = [string]$contract.gradle.distributionSha256Sum
    fixtureSha256 = Get-LowerSha256 $fixturePath
    generatedWith = [ordered]@{
        javaMajor = [int]$contract.java.requiredMajor
        javaReleaseFileSha256 = Get-LowerSha256 (Join-Path $JavaHomePath 'release')
        gradleLauncherFileName = [IO.Path]::GetFileName($GradleExecutable)
        gradleLauncherSha256 = Get-LowerSha256 $GradleExecutable
    }
    inventorySelfExcluded = $true
    files = @($records)
}
Write-Utf8NoBom $inventoryPath ($inventory | ConvertTo-Json -Depth 8)
[void](Test-Wrapper -ThrowOnFailure)
Write-Host "Generated and checksum-bound Gradle $($contract.gradle.version) wrapper at: $ProjectRoot"
Write-Host 'No Android SDK task, build, signing, emulator, or device command was executed.'
